import * as git from 'isomorphic-git';
import fs from 'fs';
import { loadToken, saveOAuth } from './auth-store';
import "./ipc-oauth";
import path from 'path';
import { BITBUCKET_CLIENT_ID, CLIENT_BITBUCKET_SECRET } from './ipc-oauth';

export function normalizeRemoteUrl(url: string) {
  // git@github.com:owner/repo.git -> https://github.com/owner/repo.git
  const ssh = url.match(/^git@([^:]+):(.+?)(\.git)?$/);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}.git`;
  return url;
}

export async function getRemoteInfo(dir: string, remote = 'origin') {
  const url =
    (await git.getConfig({ fs, dir, path: `remote.${remote}.url` })) ?? '';
  const httpsUrl = normalizeRemoteUrl(url);
  const { host } = new URL(httpsUrl); // 'github.com' | 'bitbucket.org' | '<bb-server>'
  return { url: httpsUrl, host };
}

async function refreshBitbucketToken(opts: {
  clientId: string;
  clientSecret: string;
  refresh_token: string;
}) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: opts.refresh_token,
  });

  const resp = await fetch('https://bitbucket.org/site/oauth2/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:
        'Basic ' +
        Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString('base64'),
    },
    body,
  });

  const json = await resp.json();
  if (!resp.ok || !json.access_token) {
    const msg = json.error_description || json.error || 'Bitbucket refresh failed';
    throw new Error(msg);
  }

  const expires_at =
    Date.now() + Math.max(0, (Number(json.expires_in ?? 7200) - 60)) * 1000;

  return {
    access_token: json.access_token as string,
    refresh_token: (json.refresh_token as string) || undefined, // may rotate
    expires_at,
  };
}

async function ensureBitbucketAccessToken(host: string, account: string, clientId: string, clientSecret: string) {
  const rec = loadToken(host, account);
  if (!rec?.token) throw new Error('No token saved for this host/account.');

  // If not near expiry, use as-is
  if (!isExpiringSoon(rec.expires_at)) return rec.token as string;

  if (!rec.refresh_token) {
    throw new Error('Bitbucket token expired and no refresh token is available.');
  }

  const { access_token, refresh_token, expires_at } = await refreshBitbucketToken({
    clientId,
    clientSecret,
    refresh_token: rec.refresh_token,
  });

  // Persist rotation & new expiry
  saveOAuth(host, 'bitbucket', account, access_token, refresh_token ?? rec.refresh_token, expires_at);

  return access_token;
}

// Factory with refresh support for Bitbucket
export async function onAuthFactory(
  dir: string,
  url: string = '',
  preferredAccount?: string,
  opts?: { bitbucketClientId?: string; bitbucketClientSecret?: string }
) {
  let host: string;
  if (url === '') {
    host = (await getRemoteInfo(dir)).host;
  } else {
    const httpsUrl = normalizeRemoteUrl(url);
    host = new URL(httpsUrl).host; // 'github.com' | 'bitbucket.org' | '<bb-server>'
  }

  return async () => {
    const account = preferredAccount || (host === 'github.com' ? 'git' : '');
    const rec = loadToken(host, account);
    if (!rec?.token) return {};

    // Bitbucket with OAuth (+refresh)
    if (rec.provider === 'bitbucket' && host === 'bitbucket.org') {
      const clientId = opts?.bitbucketClientId || BITBUCKET_CLIENT_ID;
      const clientSecret = opts?.bitbucketClientSecret || CLIENT_BITBUCKET_SECRET;
      if (!clientId || !clientSecret) {
        // Fall back to current token if no creds to refresh
        return { oauth2format: 'bitbucket' as const, token: rec.token };
      }

      let token = rec.token as string;
      try {
        if (isExpiringSoon(rec.expires_at)) {
          token = await ensureBitbucketAccessToken(host, account, clientId, clientSecret);
        }
      } catch (e) {
        // If refresh fails, still try with current token; the Git op may 401 and your UI can prompt re-auth.
        console.warn('Bitbucket refresh failed:', e);
      }

      // return { oauth2format: 'bitbucket' as const, token };
      return {username: 'x-token-auth',
        password: token }
    }

    // GitHub OAuth token via isomorphic-git (no refresh here) or PAT/basic for anything else
    return { username: account || 'git', password: rec.token };
  };
}

export type TreeSpec = 'HEAD' | 'INDEX' | 'WORKDIR' | string;

export const isBinary = (buf?: Uint8Array | Buffer | null) => {
  if (!buf) return false;
  const b = Buffer.from(buf);
  const lim = Math.min(b.length, 8000);
  for (let i = 0; i < lim; i++) if (b[i] === 0) return true;
  return false;
};

export async function readFromWorkdir(dir: string, filepath: string) {
  try { return fs.readFileSync(path.join(dir, filepath)); } catch { return null; }
}

export async function readFromCommit(dir: string, ref: string, filepath: string) {
  try {
    const oid = await git.resolveRef({ fs, dir, ref });
    const { blob } = await git.readBlob({ fs, dir, oid, filepath });
    return Buffer.from(blob);
  } catch { return null; }
}

export async function readFromIndex(dir: string, filepath: string) {
  // STAGE walker can't give content(), but it gives blob oid → readBlob() yourself. :contentReference[oaicite:1]{index=1}
  let indexOid: string | undefined;
  const results = await git.walk({
    fs, dir,
    trees: [git.STAGE()],
    map: async (fp, [st]) => {
      if (fp === filepath && st) return await st.oid();
    },
  });
  for (const maybe of results as Array<string | undefined>) {
    if (maybe) { indexOid = maybe; break; }
  }
  if (!indexOid) return null;
  const { blob } = await git.readBlob({ fs, dir, oid: indexOid });
  return Buffer.from(blob);
}

export async function readSpec(dir: string, spec: TreeSpec, filepath: string) {
  if (spec === 'WORKDIR') return readFromWorkdir(dir, filepath);
  if (spec === 'INDEX')   return readFromIndex(dir, filepath);
  return readFromCommit(dir, spec, filepath); // HEAD or any commit-ish
}

export function treeFor(spec: TreeSpec) {
  if (spec === 'WORKDIR') return git.WORKDIR();
  if (spec === 'INDEX')   return git.STAGE();
  return git.TREE({ ref: spec }); // HEAD or commit-ish
}

export async function discoverPaths(dir: string, base: TreeSpec, target: TreeSpec, only?: string[] | string) {
  if (only) return Array.isArray(only) ? only : [only];

  // union of files present in either side
  const out = await git.walk({
    fs, dir,
    trees: [treeFor(base), treeFor(target)],
    map: async (filepath, [a, b]) => {
      const ta = await a?.type();
      const tb = await b?.type();
      if (ta === 'blob' || tb === 'blob') return filepath;
    },
  });
  return (out as string[]).filter(Boolean);
}

export async function listPaths(dir: string, base: TreeSpec, target: TreeSpec, only?: string[] | string) {
  if (only) return Array.isArray(only) ? only : [only];
  const out = await git.walk({
    fs, dir,
    trees: [treeFor(base), treeFor(target)],
    map: async (filepath, [a, b]) => {
      const ta = await a?.type();
      const tb = await b?.type();
      if (ta === 'blob' || tb === 'blob') return filepath;
    },
  });
  return (out as string[]).filter(Boolean);
}

export function getSubmodulePaths(dir: string): string[] {
  const gm = path.join(dir, '.gitmodules');
  if (!fs.existsSync(gm)) return [];
  const text = fs.readFileSync(gm, 'utf8');
  // naive parser is fine here; looks for "path = foo/bar"
  const paths: string[] = [];
  for (const m of text.matchAll(/^\s*path\s*=\s*(.+)\s*$/gm)) {
    const p = m[1].trim().replace(/^\.\/+/, ''); // normalize
    if (p) paths.push(p);
  }
  return paths;
}

export function insideAnySubmodule(fp: string, submods: string[]) {
  // inside if it startsWith "<path>/" (strictly deeper than the root)
  return submods.some((p) => fp !== p && (fp.startsWith(p + '/') || fp.startsWith(p + path.posix.sep)));
}

export function isExpiringSoon(expires_at?: number, skewMs = 60_000): boolean {
  if (!expires_at) return true; // no expiry info → treat as expiring
  return Date.now() >= (expires_at - skewMs);
}

export function toRefIdx(input: string | number | undefined, fallback = 0): number {
  if (typeof input === 'number' && Number.isInteger(input) && input >= 0) return input;

  if (typeof input === 'string') {
    const s = input.trim();

    // "stash@{N}"
    let m = s.match(/^stash@{\s*(\d+)\s*}$/i);
    if (m) return parseInt(m[1], 10);

    // "refs/stash@{N}" (sometimes shown in UIs)
    m = s.match(/^refs\/stash@{\s*(\d+)\s*}$/i);
    if (m) return parseInt(m[1], 10);

    // plain integer string
    if (/^\d+$/.test(s)) return parseInt(s, 10);

    // aliases for the newest stash
    if (/^(latest|head|top)$/i.test(s)) return 0;
  }

  return fallback; // let isomorphic-git error if out-of-range later
}
