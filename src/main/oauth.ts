// main/oauth.ts
import { shell } from 'electron';
import http from 'http';
import crypto from 'crypto';

const b64url = (buf: Buffer) =>
  buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

function pkcePair() {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(
    crypto.createHash('sha256').update(verifier).digest(),
  );
  return { verifier, challenge };
}

async function listenOnce(
  port: number,
): Promise<{ code?: string; state?: string; error?: string }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url!, `http://127.0.0.1:${port}`);
      const code = url.searchParams.get('code') ?? undefined;
      const state = url.searchParams.get('state') ?? undefined;
      const error = url.searchParams.get('error') ?? undefined;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body>You can close this window.</body></html>');
      server.close(() => resolve({ code, state, error }));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function randomPort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = http.createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as any;
      srv.close(() => resolve(port));
    });
  });
}

export type OAuthResult = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

// ---- GitHub OAuth (PKCE) ----
export async function oauthGithub(
  clientId: string,
  scopes: string[] = ['repo'],
): Promise<OAuthResult> {
  const port = await randomPort();
  const redirect_uri = `http://127.0.0.1:${port}/oauth/callback`;
  const state = b64url(crypto.randomBytes(16));
  const { verifier, challenge } = pkcePair();

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirect_uri);
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  await shell.openExternal(authUrl.toString());
  const { code, state: retState, error } = await listenOnce(port);
  if (error) throw new Error(error);
  if (!code || retState !== state)
    throw new Error('OAuth: code/state mismatch');

  // Exchange code (GitHub supports PKCE without client_secret)
  const resp = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri,
      code_verifier: verifier,
    }),
  });
  const json = await resp.json();
  if (!resp.ok)
    throw new Error(json.error_description || 'Token exchange failed');
  return json; // { access_token, token_type, scope, ... }
}

// ---- Bitbucket Cloud OAuth (PKCE) ----
export async function oauthBitbucket(
  clientId: string,
  scopes: string[] = ['repository'],
): Promise<OAuthResult> {
  const port = await randomPort();
  const redirect_uri = `http://127.0.0.1:${port}/oauth/callback`;
  const state = b64url(crypto.randomBytes(16));
  const { verifier, challenge } = pkcePair();

  const authUrl = new URL('https://bitbucket.org/site/oauth2/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirect_uri);
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  await shell.openExternal(authUrl.toString());
  const { code, state: retState, error } = await listenOnce(port);
  if (error) throw new Error(error);
  if (!code || retState !== state)
    throw new Error('OAuth: code/state mismatch');

  // Token exchange (PKCE public client: no client_secret)
  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri,
    code_verifier: verifier,
  });
  const resp = await fetch('https://bitbucket.org/site/oauth2/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const json = await resp.json();
  if (!resp.ok)
    throw new Error(json.error_description || 'Token exchange failed');
  return json; // { access_token, refresh_token, expires_in, token_type }
}
