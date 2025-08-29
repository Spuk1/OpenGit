import * as git from 'isomorphic-git';
import fs from 'fs';
import { loadToken } from './auth-store';
import path from 'path';

export function normalizeRemoteUrl(url: string) {
  // git@github.com:owner/repo.git -> https://github.com/owner/repo.git
  const ssh = url.match(/^git@([^:]+):(.+?)(\.git)?$/);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}.git`;
  return url;
}

export async function getRemoteInfo(dir: string, remote = 'origin') {
  const url =
    (await git.getConfig({ fs, dir, path: `remote.${remote}.url` })) ?? '';
  console.log(url)
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
    console.log(rec)
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