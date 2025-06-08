/* eslint-disable @typescript-eslint/no-unused-vars */
import { dialog, ipcMain, IpcMainInvokeEvent } from 'electron';
import path from 'path';

let selectedRepoPath: string | null = '/home/leon/projects/OpenGit';

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

ipcMain.handle('fetch', async (_event: IpcMainInvokeEvent): Promise<void> => {
  if (!selectedRepoPath) throw new Error('No repository selected');
  const { execa } = await initExeca();
  await execa('git', ['fetch'], { cwd: selectedRepoPath });
});

ipcMain.handle('pull', async (_event: IpcMainInvokeEvent): Promise<void> => {
  if (!selectedRepoPath) throw new Error('No repository selected');
  const { execa } = await initExeca();
  await execa('git', ['pull'], { cwd: selectedRepoPath });
});

ipcMain.handle('push', async (_event: IpcMainInvokeEvent): Promise<void> => {
  if (!selectedRepoPath) throw new Error('No repository selected');
  const { execa } = await initExeca();
  await execa('git', ['push'], { cwd: selectedRepoPath });
});

ipcMain.handle('stash', async (_event: IpcMainInvokeEvent): Promise<void> => {
  if (!selectedRepoPath) throw new Error('No repository selected');
  const { execa } = await initExeca();
  await execa('git', ['stash'], { cwd: selectedRepoPath });
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

async function getBranches(
  repoPath: string,
): Promise<{ local: string[]; remote: string[] }> {
  const { execa } = await initExeca();
  const { stdout: localOut } = await execa('git', ['branch'], {
    cwd: repoPath,
  });
  const { stdout: remoteOut } = await execa('git', ['branch', '-r'], {
    cwd: repoPath,
  });

  const local = localOut
    .split('\n')
    .map((l) => l.replace(/^[* ]+/, '').trim())
    .filter(Boolean);

  const remote = remoteOut
    .split('\n')
    .map((r) => r.trim().replace(/^origin\//, '')) // remove "origin/" prefix
    .filter((r) => !r.includes('->')) // filter out symbolic refs like origin/HEAD -> origin/main
    .filter(Boolean);

  return { local, remote };
}

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
