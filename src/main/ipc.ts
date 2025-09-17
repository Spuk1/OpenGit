// electron-ipc-isomorphic-git.ts
import { dialog, ipcMain, IpcMainInvokeEvent } from 'electron';
import fs from 'fs';
import path from 'path';
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import { discoverPaths, getRemoteInfo, getSubmodulePaths, insideAnySubmodule, isBinary, listPaths, onAuthFactory, readSpec, toRefIdx, TreeSpec } from './git-helpers';
import { getIdentity, setIdentity } from './git-identity';
import { createTwoFilesPatch } from 'diff';
import { refreshBitbucketToken } from './ipc-oauth';

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
  const start = performance.now();
  try {
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
  } finally {
    console.log(`open-file-dialog took ${performance.now() - start}ms`);
  }
});

ipcMain.handle('set-selected-repository', async (_e, repo: string) => {
  const start = performance.now();
  try {
    if (repo) selectedRepoPath = repo;
  } finally {
    console.log(`set-selected-repository took ${performance.now() - start}ms`);
  }
});

ipcMain.handle('get-repo-path', () => {
  const start = performance.now();
  try {
    assertRepo();
    return selectedRepoPath!;
  } finally {
    console.log(`get-repo-path took ${performance.now() - start}ms`);
  }
});

ipcMain.handle('git:get-identity', async () => {
  const start = performance.now();
  try {
    assertRepo();
    return getIdentity(selectedRepoPath!);
  } finally {
    console.log(`git:get-identity took ${performance.now() - start}ms`);
  }
});

ipcMain.handle('git:set-identity', async (_e, name: string, email: string) => {
  const start = performance.now();
  try {
    assertRepo();
    if (!name || !email) throw new Error('Both name and email are required.');
    await setIdentity(selectedRepoPath!, name, email);
    return { ok: true };
  } finally {
    console.log(`git:set-identity took ${performance.now() - start}ms`);
  }
});

/**
 * Current branch
 */
ipcMain.handle('get-branch', async () => {
  const start = performance.now();
  try {
    assertRepo();
    try {
      const branch = await git.currentBranch({
        fs,
        dir: selectedRepoPath!,
        fullname: false,
      });
      return branch ?? '';
    }
    catch {
      return ""
    }
  } finally {
    console.log(`get-branch took ${performance.now() - start}ms`);
  }
});

ipcMain.handle('fetch', async () => {
  const start = performance.now();
  try {
    if (!selectedRepoPath) throw new Error('No repository selected');
    const { url } = await getRemoteInfo(selectedRepoPath);
    const onAuth = await onAuthFactory(selectedRepoPath);
    try {
      await git.fetch({
        fs,
        http,
        dir: selectedRepoPath,
        url,
        prune: true,
        onAuth,
      });
    }
    catch (error) {
      console.error(error)
    }
  } finally {
    console.log(`fetch took ${performance.now() - start}ms`);
  }
});

ipcMain.handle('push', async () => {
  const start = performance.now();
  try {
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
  } finally {
    console.log(`push took ${performance.now() - start}ms`);
  }
});

/**
 * Pull current branch (fast-forward or merge if needed)
 */
ipcMain.handle('pull', async () => {
  const start = performance.now();
  try {
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
  } finally {
    console.log(`pull took ${performance.now() - start}ms`);
  }
});

/**
 * Create branch
 */
ipcMain.handle('add-branch', async (_e, branchName: string) => {
  const start = performance.now();
  try {
    assertRepo();
    await git.branch({ fs, dir: selectedRepoPath!, ref: branchName });
  } finally {
    console.log(`add-branch took ${performance.now() - start}ms`);
  }
});

/**
 * List branches (local + remote)
 */
ipcMain.handle(
  'list-branches',
  async (): Promise<{ local: string[]; remote: string[] }> => {
    const start = performance.now();
    try {
      let time = new Date().valueOf()
      assertRepo();
      const local = await git.listBranches({ fs, dir: selectedRepoPath! });
      const remote = await git.listBranches({
        fs,
        dir: selectedRepoPath!,
        remote: 'origin',
      });
      return { local, remote };
    } finally {
      console.log(`list-branches took ${performance.now() - start}ms`);
    }
  },
);

/**
 * Branch commit counts (per local branch)
 */
ipcMain.handle('get-branch-commits', async () => {
  const start = performance.now();
  try {
    assertRepo();
    const branches = await git.listBranches({ fs, dir: selectedRepoPath! });
    const counts: Record<string, number> = {};
    for (const b of branches) {
      const logs = await git.log({ fs, dir: selectedRepoPath!, ref: b });
      counts[b] = logs.length;
    }
    return counts;
  } finally {
    console.log(`get-branch-commits took ${performance.now() - start}ms`);
  }
});

/**
 * Checkout branch
 */
ipcMain.handle('checkout-branch', async (_e, branch: string) => {
  const start = performance.now();
  try {
    assertRepo();
    await git.checkout({ fs, dir: selectedRepoPath!, ref: branch });
  } finally {
    console.log(`checkout-branch took ${performance.now() - start}ms`);
  }
});

/**
 * Merge branch into target
 * (No stash here; ensure clean worktree before invoking.)
 */
ipcMain.handle(
  'merge-branch',
  async (_e, sourceBranch: string, targetBranch: string) => {
    const start = performance.now();
    try {
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
        ours: sourceBranch,
        theirs: targetBranch,
        author: { name, email },
      });
      return result; // { fastForward, mergeType, oid, ... }
    } finally {
      console.log(`merge-branch took ${performance.now() - start}ms`);
    }
  },
);


ipcMain.handle('list-changes', async () => {
  const start = performance.now();
  try {
    assertRepo();
    const dir = selectedRepoPath!;
    const submods = getSubmodulePaths(dir);

    const matrix = await git.statusMatrix({
      fs, dir,
      // Skip files *within* submodules; keep the root path (gitlink) and everything else
      filter: (fp /*: string*/) => !insideAnySubmodule(fp, submods) && !fp.startsWith("test"),
    });

    // statusMatrix rows: [filepath, HEAD, WORKDIR, STAGE]
    // Unstaged = workdir !== stage
    const unstaged = matrix
      .filter(([, , workdir, stage]) => workdir !== stage)
      .map(([filepath]) => filepath);

    return unstaged;
  } finally {
    console.log(`list-changes took ${performance.now() - start}ms`);
  }
});

/**
 * Stage file
 */
ipcMain.handle('stage-file', async (_e, file: string) => {
  const start = performance.now();
  try {
    assertRepo();
    await git.add({ fs, dir: selectedRepoPath!, filepath: file });
  } finally {
    console.log(`stage-file took ${performance.now() - start}ms`);
  }
});

/**
 * Unstage file (requires isomorphic-git with resetIndex)
 */
ipcMain.handle('unstage-file', async (_e, file: string) => {
  const start = performance.now();
  try {
    assertRepo();
    // Reset index entry to HEAD version
    await git.resetIndex({ fs, dir: selectedRepoPath!, filepath: file });
  } finally {
    console.log(`unstage-file took ${performance.now() - start}ms`);
  }
});

/**
 * Commit (reads author from config)
 */
ipcMain.handle('commit', async (_e, message: string) => {
  const start = performance.now();
  try {
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
  } finally {
    console.log(`commit took ${performance.now() - start}ms`);
  }
});

/**
 * List staged files (index differs from HEAD)
 */
ipcMain.handle('list-staged', async () => {
  const start = performance.now();
  try {
    assertRepo();
    const matrix = await git.statusMatrix({ fs, dir: selectedRepoPath! });
    const staged = matrix
      // staged changes: STAGE !== HEAD
      .filter(([, head, , stage]) => head !== stage)
      .map(([filepath]) => filepath);
    return staged;
  } finally {
    console.log(`list-staged took ${performance.now() - start}ms`);
  }
});


// 1) ONE shared cache across all git calls in main (critical for speed)
const gitCache: Record<string, any> = {};

// 2) tiny memo to dampen bursts from the UI
const memo = new Map<string, { ts: number; behind: number; ahead: number }>();
const MEMO_TTL_MS = 4000;

// Read a commit’s parents quickly
async function parentsOf(dir: string, oid: string): Promise<string[]> {
  const { commit } = await git.readCommit({ fs, dir, oid, cache: gitCache });
  return commit.parent || [];
}

// --- helpers ---
async function isDesc(dir: string, oid: string, ancestor: string) {
  try {
    // true if `ancestor` is an ancestor of `oid`
    return await git.isDescendent({ fs, dir, oid, ancestor, cache: gitCache })
  } catch {
    return false
  }
}

async function countUntilStops(
  dir: string,
  tip: string,
  stop: Set<string>,
  cap = 20000
) {
  // DFS counting unique commits reachable from `tip` that are NOT in `stop`
  const seen = new Set<string>()
  const stack = [tip]
  let count = 0

  while (stack.length && seen.size < cap) {
    const cur = stack.pop()!
    if (seen.has(cur) || stop.has(cur)) continue
    seen.add(cur)
    count++
    const parents = await parentsOf(dir, cur)
    for (const p of parents) if (!seen.has(p)) stack.push(p)
  }
  // do not count the stop nodes themselves
  return count
}

// --- accurate ahead/behind with ancestry fast-path ---
async function aheadBehindAccurate(dir: string, a: string, b: string) {
  if (a === b) return { ahead: 0, behind: 0 }

  // Fast paths (most real-world branch comparisons)
  if (await isDesc(dir, a, b)) {
    // local A contains remote B -> we’re only ahead
    const ahead = await countUntilStops(dir, a, new Set([b]))
    return { ahead, behind: 0 }
  }
  if (await isDesc(dir, b, a)) {
    // remote B contains local A -> we’re only behind
    const behind = await countUntilStops(dir, b, new Set([a]))
    return { ahead: 0, behind }
  }

  // General case: compute set differences of ancestors(A) vs ancestors(B)
  // with pruning when we cross into the other set.
  const seenA = new Set<string>()
  const seenB = new Set<string>()
  const qa: string[] = [a]
  const qb: string[] = [b]
  const CAP = 50000

  while ((qa.length || qb.length) && (seenA.size + seenB.size) < CAP) {
    if (qa.length) {
      const cur = qa.pop()!
      if (!seenA.has(cur)) {
        seenA.add(cur)
        if (!seenB.has(cur)) {
          const ps = await parentsOf(dir, cur)
          for (const p of ps) if (!seenA.has(p)) qa.push(p)
        }
      }
    }
    if (qb.length) {
      const cur = qb.pop()!
      if (!seenB.has(cur)) {
        seenB.add(cur)
        if (!seenA.has(cur)) {
          const ps = await parentsOf(dir, cur)
          for (const p of ps) if (!seenB.has(p)) qb.push(p)
        }
      }
    }
  }

  let ahead = 0, behind = 0
  for (const x of seenA) if (!seenB.has(x)) ahead++
  for (const x of seenB) if (!seenA.has(x)) behind++

  return { ahead, behind }
}



ipcMain.handle('get-branch-revs', async (_e, branch: string, remote = 'origin') => {
  assertRepo();
  const dir = selectedRepoPath!;
  const key = `${branch}|${remote}`;
  const now = Date.now();

  // memo
  const m = memo.get(key);
  if (m && now - m.ts < MEMO_TTL_MS) {
    return `${m.behind}\t${m.ahead}`;
  }

  const start = performance.now();
  try {
    // resolve refs once (use full remote ref for reliability)
    const [a, b] = await Promise.all([
      git.resolveRef({ fs, dir, ref: branch, cache: gitCache }).catch(() => null),
      git.resolveRef({ fs, dir, ref: `refs/remotes/${remote}/${branch}`, cache: gitCache }).catch(() => null),
    ]);

    if (!a || !b) {
      memo.set(key, { ts: now, ahead: 0, behind: 0 });
      return '0\t0';
    }

    // fast bidirectional search with a hard cap
    const { ahead, behind } = await aheadBehindAccurate(dir, a, b)
    memo.set(key, { ts: now, ahead, behind })
    return `${behind}\t${ahead}`
  } finally {
    console.log(`get-branch-revs (bi) took ${Math.round(performance.now() - start)}ms`);
  }
});




/**
 * Delete branch (local or remote)
 */
ipcMain.handle('delete-branch', async (_e, branch: string, remote: boolean) => {
  const start = performance.now();
  try {
    assertRepo();
    if (remote) {
      // Remote delete via push refspec ":branch" equivalent
      // isomorphic-git supports deleting by setting remoteRef and 'delete' option.
      const onAuth = await onAuthFactory(selectedRepoPath!);
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
  } finally {
    console.log(`delete-branch took ${performance.now() - start}ms`);
  }
});

const MAX_TEXT_BYTES = 2 * 1024 * 1024;
ipcMain.handle('get-diff', async (_e, args: {
  filepath: string;
  base?: TreeSpec;
  target?: TreeSpec;
  context?: number;
}) => {
  const start = performance.now();
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
  } finally {
    console.log(`get-diff took ${performance.now() - start}ms`);
  }
});

/**
 * Discard file changes (restore from HEAD)
 */
ipcMain.handle('discard-file', async (_e, file: string) => {
  const start = performance.now();
  try {
    assertRepo();
    await git.checkout({
      fs,
      dir: selectedRepoPath!,
      force: true,
      filepaths: [file],
    });
  } finally {
    console.log(`discard-file took ${performance.now() - start}ms`);
  }
});

/**
 * Checkout (no-arg): not meaningful in isomorphic-git; echo current branch
 */
ipcMain.handle('checkout', async () => {
  const start = performance.now();
  try {
    assertRepo();
    const branch = await git.currentBranch({
      fs,
      dir: selectedRepoPath!,
      fullname: false,
    });
    return { current: branch ?? '' };
  } finally {
    console.log(`checkout took ${performance.now() - start}ms`);
  }
});

/**
 * Merge current branch with provided branch (same as 'git merge <branch>')
 */
ipcMain.handle('merge', async (_e, branch: string) => {
  const start = performance.now();
  try {
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
  } finally {
    console.log(`merge took ${performance.now() - start}ms`);
  }
});

// Push working tree + index changes of TRACKED files only
ipcMain.handle('stash', async (_e: IpcMainInvokeEvent, message: string) => {
  const start = performance.now();
  try {
    assertRepo();
    await git.stash({
      fs,
      dir: selectedRepoPath!,
      op: 'push',
      message: message ?? '',
    });
  } finally {
    console.log(`stash took ${performance.now() - start}ms`);
  }
});

// List stashes (returns raw list string; we also parse to array)
ipcMain.handle('list-stashes', async () => {
  const start = performance.now();
  try {
    assertRepo();
    const raw = (await git.stash({
      fs,
      dir: selectedRepoPath!,
      op: 'list',
    })) as string;
    return raw;
  } finally {
    console.log(`list-stashes took ${performance.now() - start}ms`);
  }
});

// Apply + keep (like `git stash apply`)
ipcMain.handle(
  'apply-stash',
  async (_e, stashRefOrIdx: string | number = 0) => {
    const start = performance.now();
    try {
      assertRepo();
      const refIdx = toRefIdx(stashRefOrIdx);
      await git.stash({ fs, dir: selectedRepoPath!, op: 'apply', refIdx });
    } finally {
      console.log(`apply-stash took ${performance.now() - start}ms`);
    }
  },
);

// Pop + drop (like `git stash pop`)
ipcMain.handle('use-stash', async (_e, stashRefOrIdx: string | number = 0) => {
  const start = performance.now();
  try {
    assertRepo();
    const refIdx = toRefIdx(stashRefOrIdx);
    await git.stash({ fs, dir: selectedRepoPath!, op: 'pop', refIdx });
  } finally {
    console.log(`use-stash took ${performance.now() - start}ms`);
  }
});

// Optional: drop a specific entry
ipcMain.handle('drop-stash', async (_e, stashRefOrIdx: string | number = 0) => {
  const start = performance.now();
  try {
    assertRepo();
    const refIdx = toRefIdx(stashRefOrIdx);
    await git.stash({ fs, dir: selectedRepoPath!, op: 'drop', refIdx });
  } finally {
    console.log(`drop-stash took ${performance.now() - start}ms`);
  }
});

// Optional: clear all stashes
ipcMain.handle('clear-stashes', async () => {
  const start = performance.now();
  try {
    assertRepo();
    await git.stash({ fs, dir: selectedRepoPath!, op: 'clear' });
  } finally {
    console.log(`clear-stashes took ${performance.now() - start}ms`);
  }
});

ipcMain.handle('get-commit-log', async ()=> {
  const start = performance.now();
  try {
    assertRepo();
    const log = await git.log({ fs, dir: selectedRepoPath!, depth:10});
    return log;
  } finally {
    console.log(`get-commit-log took ${performance.now() - start}ms`);
  }
})


ipcMain.handle("clone-repo", async (_e, url : string) => {
  const start = performance.now();
  let split = url.split("/")
  let name = split[split.length-1].replace(".git", "");
  try {
    assertRepo();
    const onAuth = await onAuthFactory(selectedRepoPath!, url);
    const resp = await git.clone({
      fs,
      dir: "/home/leon/projects/"+name,
      http,
      url,
      onAuth,
      singleBranch: true,
      depth: 1,
      }
    )
    console.log(resp)
  }
  catch (error) {
    console.log(error);
  }
  finally {
    console.log(`clone-repo took ${performance.now() - start}ms`);
  }
})
