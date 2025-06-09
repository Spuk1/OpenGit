/* eslint-disable @typescript-eslint/no-unused-vars */
import { exec } from 'child_process';
import { dialog, ipcMain, IpcMainInvokeEvent } from 'electron';
import path from 'path';

let selectedRepoPath: string | null = '';

async function initExeca() {
  return import('execa');
}

initExeca();

ipcMain.handle(
  'open-file-dialog',
  async (_event: IpcMainInvokeEvent): Promise<string[]> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) return [];

    const chosenPath = result.filePaths[0];

    try {
      const { execa } = await initExeca();
      const { stdout } = await execa('git', ['rev-parse', '--show-toplevel'], {
        cwd: chosenPath,
      });
      selectedRepoPath = stdout.trim();
      return [selectedRepoPath || ''];
    } catch (error) {
      throw new Error(
        `Selected folder is not a Git repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  },
);

ipcMain.handle(
  'set-selected-repository',
  async (_event: IpcMainInvokeEvent, repo: string): Promise<void> => {
    if (!repo) return;
    selectedRepoPath = repo;
  },
);

ipcMain.handle('fetch', async (_event: IpcMainInvokeEvent): Promise<void> => {
  if (!selectedRepoPath) throw new Error('No repository selected');
  const { execa } = await initExeca();
  await execa('git', ['fetch', '-p'], { cwd: selectedRepoPath });
});

ipcMain.handle('pull', async (_event: IpcMainInvokeEvent): Promise<void> => {
  if (!selectedRepoPath) throw new Error('No repository selected');
  const { execa } = await initExeca();
  await execa('git', ['pull'], { cwd: selectedRepoPath });
});

ipcMain.handle(
  'push',
  async (_event: IpcMainInvokeEvent, setUpstream: boolean): Promise<void> => {
    if (!selectedRepoPath) throw new Error('No repository selected');
    const { execa } = await initExeca();
    if (setUpstream) {
      const { stdout } = await execa('git', ['branch', '--show-current'], {
        cwd: selectedRepoPath,
      });
      const branchName = stdout.trim();
      await execa('git', ['push', '--set-upstream', 'origin', branchName], {
        cwd: selectedRepoPath,
      });
      return;
    }
    await execa('git', ['push'], {
      cwd: selectedRepoPath,
    });
  },
);

ipcMain.handle(
  'stash',
  async (
    _event: IpcMainInvokeEvent,
    name: string,
    files: string[],
  ): Promise<void> => {
    if (!selectedRepoPath) throw new Error('No repository selected');
    const { execa } = await initExeca();
    let string = '';
    for (let i = 0; i < files.length; i += 1) {
      string += `${files[i]}${i === files.length - 1 ? '' : ' '}`;
    }
    await execa('git', ['add', string], { cwd: selectedRepoPath });
    await execa('git', ['stash', 'push', '-m', name, string], {
      cwd: selectedRepoPath,
    });
  },
);

ipcMain.handle(
  'list-stashes',
  async (_event: IpcMainInvokeEvent): Promise<any> => {
    if (!selectedRepoPath) throw new Error('No repository selected');
    const { execa } = await initExeca();
    const { stdout } = await execa('git', ['stash', 'list'], {
      cwd: selectedRepoPath,
    });
    return stdout.split('stash@');
  },
);

ipcMain.handle(
  'use-stash',
  async (_event: IpcMainInvokeEvent, stash: string): Promise<any> => {
    if (!selectedRepoPath) throw new Error('No repository selected');
    const { execa } = await initExeca();
    const { stdout } = await execa('git', ['stash', 'pop', stash], {
      cwd: selectedRepoPath,
    });
    return stdout;
  },
);

ipcMain.handle('checkout', async (_event: IpcMainInvokeEvent): Promise<any> => {
  if (!selectedRepoPath) throw new Error('No repository selected');
  const { execa } = await initExeca();
  try {
    const resp = await execa('git', ['checkout'], { cwd: selectedRepoPath });
    return resp;
  } catch (error: any) {
    return error;
  }
});

ipcMain.handle(
  'add-branch',
  async (_event: IpcMainInvokeEvent, branchName: string): Promise<void> => {
    if (!selectedRepoPath) throw new Error('No repository selected');
    const { execa } = await initExeca();
    await execa('git', ['checkout', '-b', branchName], {
      cwd: selectedRepoPath,
    });
  },
);

ipcMain.handle('get-repo-path', () => {
  if (!selectedRepoPath) throw new Error('No repo selected');
  return selectedRepoPath;
});

ipcMain.handle(
  'list-branches',
  async (): Promise<{ local: string[]; remote: string[] }> => {
    if (!selectedRepoPath) throw new Error('No repository selected');
    const { execa } = await initExeca();
    const { stdout: localOut } = await execa('git', ['branch'], {
      cwd: selectedRepoPath,
    });
    const { stdout: remoteOut } = await execa('git', ['branch', '-r'], {
      cwd: selectedRepoPath,
    });

    const local = localOut
      .split('\n')
      .map((l) => l.replace(/^[* ]+/, '').trim())
      .filter(Boolean);

    const remote = remoteOut
      .split('\n')
      .map((r: string) => r.trim().replace(/^origin\//, ''))
      .filter((r: string | string[]) => !r.includes('->'))
      .filter(Boolean);

    return { local, remote };
  },
);

ipcMain.handle('get-branch-commits', async () => {
  if (!selectedRepoPath) throw new Error('No repository selected');
  const { execa } = await initExeca();
  const { stdout } = await execa(
    'git',
    ['for-each-ref', '--format=%(refname:short)', 'refs/heads/'],
    { cwd: selectedRepoPath },
  );
  const branches = stdout.split('\n').filter(Boolean);
  const commitCounts: Record<string, number> = {};

  for (const branchName of branches) {
    // eslint-disable-next-line no-await-in-loop
    const { stdout: count } = await execa(
      'git',
      ['rev-list', '--count', branchName],
      { cwd: selectedRepoPath },
    );
    commitCounts[branchName] = parseInt(count.trim(), 10);
  }

  return commitCounts;
});

ipcMain.handle('checkout-branch', async (_event, branch: string) => {
  if (!selectedRepoPath) throw new Error('No repository selected');
  const { execa } = await initExeca();
  await execa('git', ['checkout', branch], { cwd: selectedRepoPath });
});

ipcMain.handle(
  'merge-branch',
  async (_event, sourceBranch: string, targetBranch: string) => {
    if (!selectedRepoPath) throw new Error('No repository selected');
    const { execa } = await initExeca();
    await execa('git', ['checkout', targetBranch], { cwd: selectedRepoPath });
    await execa('git', ['merge', sourceBranch], { cwd: selectedRepoPath });
  },
);

ipcMain.handle('list-changes', async () => {
  if (!selectedRepoPath) throw new Error('No repository selected');
  const { execa } = await initExeca();

  const { stdout } = await execa('git', ['status', '--porcelain'], {
    cwd: selectedRepoPath,
  });

  const unstagedFiles = stdout
    .split('\n')
    .filter(Boolean)
    .filter((line) => line[1] !== ' ') // 2nd char = working tree status (unstaged)
    .map((line) => line.slice(3).trim());

  return unstagedFiles;
});

ipcMain.handle('stage-file', async (_event, file: string) => {
  if (!selectedRepoPath) throw new Error('No repository selected');
  const { execa } = await initExeca();
  await execa('git', ['add', file], { cwd: selectedRepoPath });
});

ipcMain.handle('unstage-file', async (_event, file: string) => {
  if (!selectedRepoPath) throw new Error('No repository selected');
  const { execa } = await initExeca();
  await execa('git', ['reset', 'HEAD', file], { cwd: selectedRepoPath });
});

ipcMain.handle('commit', async (_event, message: string) => {
  if (!selectedRepoPath) throw new Error('No repository selected');
  const { execa } = await initExeca();
  await execa('git', ['commit', '-m', message], { cwd: selectedRepoPath });
});

ipcMain.handle('list-staged', async () => {
  if (!selectedRepoPath) throw new Error('No repository selected');
  const { execa } = await initExeca();
  const { stdout } = await execa('git', ['diff', '--cached', '--name-only'], {
    cwd: selectedRepoPath,
  });
  return stdout.split('\n').filter(Boolean);
});

// Delete branch
// local: git branch -D branch_name
// remote: git push origin --delete branch_name
