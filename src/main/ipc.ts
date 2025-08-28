// electron-ipc-isomorphic-git.ts
import { dialog, ipcMain, IpcMainInvokeEvent } from 'electron';
import fs from 'fs';
import path from 'path';
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import { discoverPaths, getRemoteInfo, isBinary, listPaths, onAuthFactory, readSpec, TreeSpec } from './git-helpers';
import { getIdentity, setIdentity } from './git-identity';
import { createTwoFilesPatch } from 'diff';

export let selectedRepoPath: string | null = '';

/**
 * Helper: assert repo selected
 */
export function assertRepo() {
  if (!selectedRepoPath) throw new Error('No repository selected');
}

/**
 * Open folder, ensure it's a Git repo (by resolving HEAD)
 */
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return [];

  const chosenPath = result.filePaths[0];
  try {
    // Will throw if not a repo
    await git.resolveRef({ fs, dir: chosenPath, ref: 'HEAD' });
    selectedRepoPath = chosenPath;
    return [selectedRepoPath];
  } catch (error: any) {
    throw new Error(
      `Selected folder is not a Git repository: ${error?.message ?? 'Unknown error'}`,
    );
  }
});

ipcMain.handle('set-selected-repository', async (_e, repo: string) => {
  if (repo) selectedRepoPath = repo;
});

ipcMain.handle('get-repo-path', () => {
  assertRepo();
  return selectedRepoPath!;
});

ipcMain.handle('git:get-identity', async () => {
  assertRepo();
  return getIdentity(selectedRepoPath!);
});

ipcMain.handle('git:set-identity', async (_e, name: string, email: string) => {
  assertRepo();
  if (!name || !email) throw new Error('Both name and email are required.');
  await setIdentity(selectedRepoPath!, name, email);
  return { ok: true };
});

/**
 * Current branch
 */
ipcMain.handle('get-branch', async () => {
  assertRepo();
  const branch = await git.currentBranch({
    fs,
    dir: selectedRepoPath!,
    fullname: false,
  });
  return branch ?? '';
});

ipcMain.handle('fetch', async () => {
  if (!selectedRepoPath) throw new Error('No repository selected');
  const { url } = await getRemoteInfo(selectedRepoPath);
  const onAuth = await onAuthFactory(selectedRepoPath);
  await git.fetch({
    fs,
    http,
    dir: selectedRepoPath,
    url,
    prune: true,
    onAuth,
  });
});

ipcMain.handle('push', async () => {
  if (!selectedRepoPath) throw new Error('No repository selected');
  const branch = await git.currentBranch({
    fs,
    dir: selectedRepoPath,
    fullname: false,
  });
  if (!branch) throw new Error('No current branch');
  const { url } = await getRemoteInfo(selectedRepoPath);
  const onAuth = await onAuthFactory(selectedRepoPath);
  await git.push({
    fs,
    http,
    dir: selectedRepoPath,
    url,
    ref: branch,
    remoteRef: `refs/heads/${branch}`,
    onAuth,
  });
});

/**
 * Pull current branch (fast-forward or merge if needed)
 */
ipcMain.handle('pull', async () => {
  if (!selectedRepoPath) throw new Error('No repository selected');

  const branch = await git.currentBranch({
    fs,
    dir: selectedRepoPath!,
    fullname: false,
  });
  if (!branch) throw new Error('No current branch');
  // Read author from config for merge commits if needed
  const name =
    (await git.getConfig({ fs, dir: selectedRepoPath!, path: 'user.name' })) ??
    'User';
  const email =
    (await git.getConfig({ fs, dir: selectedRepoPath!, path: 'user.email' })) ??
    'user@example.com';
  const onAuth = await onAuthFactory(selectedRepoPath);
  const { url } = await getRemoteInfo(selectedRepoPath);
  await git.pull({
    fs,
    http,
    url,
    dir: selectedRepoPath!,
    ref: branch,
    singleBranch: true,
    author: { name, email },
    onAuth,
  });
});

/**
 * Create branch
 */
ipcMain.handle('add-branch', async (_e, branchName: string) => {
  assertRepo();
  await git.branch({ fs, dir: selectedRepoPath!, ref: branchName });
});

/**
 * List branches (local + remote)
 */
ipcMain.handle(
  'list-branches',
  async (): Promise<{ local: string[]; remote: string[] }> => {
    assertRepo();
    const local = await git.listBranches({ fs, dir: selectedRepoPath! });
    const remote = await git.listBranches({
      fs,
      dir: selectedRepoPath!,
      remote: 'origin',
    });
    return { local, remote };
  },
);

/**
 * Branch commit counts (per local branch)
 */
ipcMain.handle('get-branch-commits', async () => {
  assertRepo();
  const branches = await git.listBranches({ fs, dir: selectedRepoPath! });
  const counts: Record<string, number> = {};
  for (const b of branches) {
    const logs = await git.log({ fs, dir: selectedRepoPath!, ref: b });
    counts[b] = logs.length;
  }
  return counts;
});

/**
 * Checkout branch
 */
ipcMain.handle('checkout-branch', async (_e, branch: string) => {
  assertRepo();
  await git.checkout({ fs, dir: selectedRepoPath!, ref: branch });
});

/**
 * Merge branch into target
 * (No stash here; ensure clean worktree before invoking.)
 */
ipcMain.handle(
  'merge-branch',
  async (_e, sourceBranch: string, targetBranch: string) => {
    assertRepo();
    // checkout target, then merge source
    await git.checkout({ fs, dir: selectedRepoPath!, ref: targetBranch });
    const name =
      (await git.getConfig({
        fs,
        dir: selectedRepoPath!,
        path: 'user.name',
      })) ?? 'User';
    const email =
      (await git.getConfig({
        fs,
        dir: selectedRepoPath!,
        path: 'user.email',
      })) ?? 'user@example.com';

    const result = await git.merge({
      fs,
      dir: selectedRepoPath!,
      ours: targetBranch,
      theirs: sourceBranch,
      author: { name, email },
    });
    return result; // { fastForward, mergeType, oid, ... }
  },
);

/**
 * List unstaged changes (files changed in working tree vs index)
 */
ipcMain.handle('list-changes', async () => {
  assertRepo();
  const matrix = await git.statusMatrix({ fs, dir: selectedRepoPath! });
  // statusMatrix rows: [filepath, HEAD, WORKDIR, STAGE]
  // Unstaged = workdir !== stage
  const unstaged = matrix
    .filter(([, , workdir, stage]) => workdir !== stage)
    .map(([filepath]) => filepath);
  return unstaged;
});

/**
 * Stage file
 */
ipcMain.handle('stage-file', async (_e, file: string) => {
  assertRepo();
  await git.add({ fs, dir: selectedRepoPath!, filepath: file });
});

/**
 * Unstage file (requires isomorphic-git with resetIndex)
 */
ipcMain.handle('unstage-file', async (_e, file: string) => {
  assertRepo();
  // Reset index entry to HEAD version
  await git.resetIndex({ fs, dir: selectedRepoPath!, filepath: file });
});

/**
 * Commit (reads author from config)
 */
ipcMain.handle('commit', async (_e, message: string) => {
  assertRepo();
  const name =
    (await git.getConfig({ fs, dir: selectedRepoPath!, path: 'user.name' })) ??
    'User';
  const email =
    (await git.getConfig({ fs, dir: selectedRepoPath!, path: 'user.email' })) ??
    'user@example.com';
  const oid = await git.commit({
    fs,
    dir: selectedRepoPath!,
    message,
    author: { name, email },
  });
  return oid;
});

/**
 * List staged files (index differs from HEAD)
 */
ipcMain.handle('list-staged', async () => {
  assertRepo();
  const matrix = await git.statusMatrix({ fs, dir: selectedRepoPath! });
  const staged = matrix
    // staged changes: STAGE !== HEAD
    .filter(([, head, , stage]) => head !== stage)
    .map(([filepath]) => filepath);
  return staged;
});

/**
 * Ahead/Behind vs origin/<branch>
 */
ipcMain.handle('get-branch-revs', async (_e, branch: string) => {
  assertRepo();
  const local = await git.log({ fs, dir: selectedRepoPath!, ref: branch });
  const remoteRef = `origin/${branch}`;
  let remote: git.ReadCommitResult[] = [];
  try {
    remote = await git.log({ fs, dir: selectedRepoPath!, ref: remoteRef });
  } catch {
    return '0 \t0';
  }

  const localSet = new Set(local.map((c) => c.oid));
  const remoteSet = new Set(remote.map((c) => c.oid));
  const ahead = local.filter((c) => !remoteSet.has(c.oid)).length;
  const behind = remote.filter((c) => !localSet.has(c.oid)).length;
  return `${behind} \t${ahead}`; // mimic `git rev-list --left-right --count origin/branch...branch`
});

/**
 * Delete branch (local or remote)
 */
ipcMain.handle('delete-branch', async (_e, branch: string, remote: boolean) => {
  assertRepo();
  if (remote) {
    // Remote delete via push refspec ":branch" equivalent
    // isomorphic-git supports deleting by setting remoteRef and 'delete' option.
    await git.push({
      fs,
      http,
      dir: selectedRepoPath!,
      remote: 'origin',
      remoteRef: `refs/heads/${branch}`,
      delete: true,
      onAuth,
    });
  } else {
    await git.deleteBranch({ fs, dir: selectedRepoPath!, ref: branch });
  }
});

const MAX_TEXT_BYTES = 2 * 1024 * 1024;
ipcMain.handle('get-diff', async (_e, args: {
  filepath: string;
  base?: TreeSpec;
  target?: TreeSpec;
  context?: number;
}) => {
  try {
    assertRepo();
    const dir = selectedRepoPath!;
    const filepath = args.filepath.replace(/^[./]+/, ''); // normalize
    if (!filepath || filepath.startsWith('.git/')) {
      throw new Error('Invalid filepath');
    }

    const base   = args.base   ?? 'HEAD';
    const target = args.target ?? 'WORKDIR';
    const context = args.context ?? 3;

    const [oldBuf, newBuf] = await Promise.all([
      readSpec(dir, base, filepath),
      readSpec(dir, target, filepath),
    ]);

    // same content? (no changes)
    if (oldBuf && newBuf && oldBuf.length === newBuf.length && Buffer.compare(oldBuf, newBuf) === 0) {
      return { ok: true, filepath, base, target, patch: '' };
    }

    const candidate = newBuf ?? oldBuf;
    if ((candidate?.length ?? 0) > MAX_TEXT_BYTES) {
      return {
        ok: true, filepath, base, target,
        skipped: true, reason: 'too_large',
        patch: `diff --git a/${filepath} b/${filepath}\n# file too large to diff (${candidate!.length} bytes)\n`,
      };
    }

    if (isBinary(oldBuf) || isBinary(newBuf)) {
      return {
        ok: true, filepath, base, target, binary: true,
        patch: `diff --git a/${filepath} b/${filepath}\nBinary files differ\n`,
      };
    }

    const oldText = oldBuf ? Buffer.from(oldBuf).toString('utf8') : '';
    const newText = newBuf ? Buffer.from(newBuf).toString('utf8') : '';

    const patch = createTwoFilesPatch(
      `a/${filepath}`, `b/${filepath}`,
      oldText, newText,
      String(base), String(target),
      { context }
    );

    return { ok: true, filepath, base, target, patch };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
});

// ipcMain.handle('get-diff', async (_e, file: string) => {
//   const { patches } = await (ipcMain as any).invoke
//     ? await (global as any).electronIpcCall?.('git:diff', { filepath: file }) // in case you have a helper
//     : await (async () => await (ipcMain as any).handlers.get('git:diff')!({} as any, { filepath: file }))();
//   return patches?.[0]?.patch ?? '';
// });


/**
 * Discard file changes (restore from HEAD)
 */
ipcMain.handle('discard-file', async (_e, file: string) => {
  assertRepo();
  await git.checkout({
    fs,
    dir: selectedRepoPath!,
    force: true,
    filepaths: [file],
  });
});

/**
 * Checkout (no-arg): not meaningful in isomorphic-git; echo current branch
 */
ipcMain.handle('checkout', async () => {
  assertRepo();
  const branch = await git.currentBranch({
    fs,
    dir: selectedRepoPath!,
    fullname: false,
  });
  return { current: branch ?? '' };
});

/**
 * Merge current branch with provided branch (same as 'git merge <branch>')
 */
ipcMain.handle('merge', async (_e, branch: string) => {
  assertRepo();
  const current = await git.currentBranch({
    fs,
    dir: selectedRepoPath!,
    fullname: false,
  });
  if (!current) throw new Error('No current branch');
  const name =
    (await git.getConfig({ fs, dir: selectedRepoPath!, path: 'user.name' })) ??
    'User';
  const email =
    (await git.getConfig({ fs, dir: selectedRepoPath!, path: 'user.email' })) ??
    'user@example.com';
  const result = await git.merge({
    fs,
    dir: selectedRepoPath!,
    ours: current,
    theirs: branch,
    author: { name, email },
  });
  return result;
});

// --- Stash helpers ---
function ensureRepo() {
  if (!selectedRepoPath) throw new Error('No repository selected');
}
function toRefIdx(stashRefOrIdx: string | number): number {
  if (typeof stashRefOrIdx === 'number') return stashRefOrIdx;
  const m = /{(\d+)}/.exec(stashRefOrIdx);
  return m ? parseInt(m[1], 10) : 0;
}

// Push working tree + index changes of TRACKED files only
ipcMain.handle('stash', async (_e: IpcMainInvokeEvent, message: string) => {
  ensureRepo();
  await git.stash({
    fs,
    dir: selectedRepoPath!,
    op: 'push',
    message: message ?? '',
  });
});

// List stashes (returns raw list string; we also parse to array)
ipcMain.handle('list-stashes', async () => {
  ensureRepo();
  const raw = (await git.stash({
    fs,
    dir: selectedRepoPath!,
    op: 'list',
  })) as string;
  // const list = raw.split('\n').map(s => s.trim()).filter(Boolean);
  // Example lines usually look like: "stash@{0}: On <branch>: <message>"
  return raw;
});

// Apply + keep (like `git stash apply`)
ipcMain.handle(
  'apply-stash',
  async (_e, stashRefOrIdx: string | number = 0) => {
    ensureRepo();
    const refIdx = toRefIdx(stashRefOrIdx);
    await git.stash({ fs, dir: selectedRepoPath!, op: 'apply', refIdx });
  },
);

// Pop + drop (like `git stash pop`)
ipcMain.handle('use-stash', async (_e, stashRefOrIdx: string | number = 0) => {
  ensureRepo();
  const refIdx = toRefIdx(stashRefOrIdx);
  await git.stash({ fs, dir: selectedRepoPath!, op: 'pop', refIdx });
});

// Optional: drop a specific entry
ipcMain.handle('drop-stash', async (_e, stashRefOrIdx: string | number = 0) => {
  ensureRepo();
  const refIdx = toRefIdx(stashRefOrIdx);
  await git.stash({ fs, dir: selectedRepoPath!, op: 'drop', refIdx });
});

// Optional: clear all stashes
ipcMain.handle('clear-stashes', async () => {
  ensureRepo();
  await git.stash({ fs, dir: selectedRepoPath!, op: 'clear' });
});

ipcMain.handle('get-commit-log', async ()=> {
  ensureRepo();
  const log = await git.log({ fs, dir: selectedRepoPath!});
  return log;
})
