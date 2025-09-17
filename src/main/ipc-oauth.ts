// main/ipc-auth.ts
import { ipcMain, shell } from 'electron';
import http from 'http';
import crypto from 'crypto';
import * as git from 'isomorphic-git';
import httpClient from 'isomorphic-git/http/node';
import fs from 'fs';
import { getRemoteInfo, isExpiringSoon } from './git-helpers';
import { selectedRepoPath } from './ipc';
import { loadToken, deleteToken, saveOAuth } from './auth-store';
import 'dotenv/config';

export const CLIENT_GITHUB_SECRET =  process.env.CLIENT_GITHUB_SECRET !== undefined ? process.env.CLIENT_GITHUB_SECRET : "";
export const CLIENT_BITBUCKET_SECRET = process.env.CLIENT_BITBUCKET_SECRET !== undefined ? process.env.CLIENT_BITBUCKET_SECRET : "";


export default function init() {}

/* -------------------------- OAUTH (PKCE + Loopback) ------------------------ */

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

async function randomPort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = http.createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as any;
      srv.close(() => resolve(port));
    });
  });
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
      res.end(
        '<html><body>Authentication complete. You can close this window.</body></html>',
      );
      server.close(() => resolve({ code, state, error }));
    });
    server.listen(port, '127.0.0.1');
  });
}

/* ---- GitHub OAuth (PKCE) ----
   Client: GitHub OAuth App (no client_secret needed with PKCE)
*/
async function oauthGithub(
  clientId: string,
  scopes: string[] = ['repo'],
): Promise<{ access_token: string }> {
  const port = 6969;
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
  console.log(code, state, retState, error);
  if (error) throw new Error(error);
  if (!code || retState !== state)
    throw new Error('OAuth: code/state mismatch');

  const resp = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      grant_type: 'authorization_code',
      client_secret: CLIENT_GITHUB_SECRET,
      code,
      redirect_uri,
      code_verifier: verifier,
    }),
  });
  const json = await resp.json();
  if (!resp.ok || !json.access_token)
    throw new Error(json.error_description || 'GitHub token exchange failed');
  return { access_token: json.access_token };
}

/* ---- Bitbucket Cloud OAuth (PKCE) ----
   Client: Bitbucket OAuth Consumer (public client)
*/
async function oauthBitbucket(
  clientId: string,
  scopes: string[] = ['repository'],
): Promise<{ access_token: string; refresh_token?: string; expires_at:number }> {
  const port = 6969;
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


  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri,
    client_secret: CLIENT_BITBUCKET_SECRET,
    code_verifier: verifier,
  });
  const resp = await fetch('https://bitbucket.org/site/oauth2/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const json = await resp.json();
  if (!resp.ok || !json.access_token)
    throw new Error(json.error_description || 'Bitbucket token exchange failed');

  // Bitbucket returns expires_in (seconds). Save an expiry a bit early (−60s).
  const expires_at = Date.now() + Math.max(0, (Number(json.expires_in ?? 7200) - 60)) * 1000;

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at,
  };
}

async function refreshBitbucketToken(opts: {
  clientId: string;
  clientSecret: string;
  refresh_token: string;
}): Promise<{ access_token: string; refresh_token?: string; expires_at?: number }> {
  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: opts.refresh_token,
  });

  const resp = await fetch('https://bitbucket.org/site/oauth2/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // Basic auth: client_id:client_secret
      Authorization:
        'Basic ' + Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString('base64'),
    },
    body: form,
  });

  const json = await resp.json();
  if (!resp.ok || !json.access_token) {
    // Common failure: invalid_grant (refresh token revoked/rotated)
    const msg = json.error_description || json.error || 'Bitbucket refresh failed';
    throw new Error(msg);
  }

  const expires_at = Date.now() + Math.max(0, (Number(json.expires_in ?? 7200) - 60)) * 1000;

  return {
    access_token: json.access_token,
    // Bitbucket often rotates the refresh_token. Use the new one if provided.
    refresh_token: json.refresh_token,
    expires_at,
  };
}


/* ---------------------- IPCs requested by your UI -------------------------- */

/** detectRemote → { host, url } */
ipcMain.handle('auth:detect-remote', async () => {
  return getRemoteInfo(selectedRepoPath!);
});

/** load(host, account) → string | null  (returns stored OAuth access token if present) */
ipcMain.handle('auth:load', async (_e, host: string, account: string) => {
  const rec = loadToken(host, account);
  return rec?.token ?? null;
});

/** del(host, account) → void  (removes stored OAuth token) */
ipcMain.handle('auth:delete', async (_e, host: string, account: string) => {
  deleteToken(host, account);
});


ipcMain.handle('auth:test', async (_e, host: string, account: string, clientId?: string) => {
  try {
    const { url } = await getRemoteInfo(selectedRepoPath!);

    let token: string | null = null;

    if (host === 'bitbucket.org') {
      if (!clientId) throw new Error('Bitbucket clientId is required to test/refresh.');
      token = await getValidAccessTokenForBitbucket(host, account, clientId);
    } else {
      // GitHub: your existing logic (GitHub PKCE flow here doesn’t issue refresh tokens for classic OAuth apps;
      // if you add GitHub refresh later, mirror the same pattern).
      const rec = loadToken(host, account);
      if (!rec?.token) return { ok: false, error: 'No token saved for this host/account.' };
      token = rec.token;
    }

    const provider =
      host === 'github.com'
        ? 'github'
        : host === 'bitbucket.org'
          ? 'bitbucket'
          : null;
    if (!provider) throw new Error(`Unsupported host for OAuth: ${host}`);

    await git.listServerRefs({
      fs: fs as any,
      http: httpClient,
      url,
      onAuth: async () => ({ oauth2format: provider as any, token: token! }),
    });

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
});


/** oauthGithub(clientId, account='git') → { ok: true } */
ipcMain.handle(
  'oauth:github',
  async (_e, clientId: string, account = 'git') => {
    const { access_token } = await oauthGithub(clientId, ['repo']);
    saveOAuth('github.com', 'github', account || 'git', access_token);
    return { ok: true };
  },
);

/** oauthBitbucket(clientId, account) → { ok: true } */
ipcMain.handle(
  'oauth:bitbucket',
  async (_e, clientId: string, account: string) => {
    const { access_token, refresh_token, expires_at } =
      await oauthBitbucket(clientId, ['repository']);

    // Save ALL pieces so we can refresh later
    saveOAuth('bitbucket.org', 'bitbucket', account, access_token, refresh_token!, expires_at);
    return { ok: true };
  },
);

async function getValidAccessTokenForBitbucket(host: string, account: string, clientId: string) {
  const rec = loadToken(host, account); // expect rec: { token, refresh_token?, expires_at?, provider }
  if (!rec?.token) throw new Error('No token saved for this host/account.');

  // If not close to expiry, use it
  if (!isExpiringSoon(rec.expires_at)) return rec.token;

  // Try to refresh if we have a refresh_token
  if (rec.refresh_token) {
    try {
      const { access_token, refresh_token, expires_at } = await refreshBitbucketToken({
        clientId,
        clientSecret: CLIENT_BITBUCKET_SECRET,
        refresh_token: rec.refresh_token,
      });

      // Persist rotated tokens/expiry
      saveOAuth('bitbucket.org', 'bitbucket', account, access_token, refresh_token ?? rec.refresh_token, expires_at);

      return access_token;
    } catch (e: any) {
      // If refresh fails (revoked/rotated), fall back to forcing re-auth
      throw new Error(`Bitbucket token refresh failed: ${e?.message || e}`);
    }
  }

  // No refresh_token → require re-auth
  throw new Error('Bitbucket token expired and no refresh token is available. Please sign in again.');
}
