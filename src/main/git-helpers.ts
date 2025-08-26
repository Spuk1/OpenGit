import * as git from 'isomorphic-git';
import fs from 'fs';
import { loadToken } from './auth-store';

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

// main/git-helpers.ts (snippet)
export async function onAuthFactory(dir: string, preferredAccount?: string) {
  const { host } = await getRemoteInfo(dir);
  return async () => {
    const account = preferredAccount || (host === 'github.com' ? 'git' : '');
    const rec = loadToken(host, account);
    if (!rec?.token) return {};
    if (rec.type === 'oauth') {
      // isomorphic-git OAuth
      const provider = host === 'github.com' ? 'github' : 'bitbucket';
      return { oauth2format: provider as any, token: rec.token };
    }
    // fallback to basic (PAT/app password)
    return { username: account || 'git', password: rec.token };
  };
}
