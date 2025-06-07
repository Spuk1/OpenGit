import { ipcMain, dialog } from 'electron';

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    filters: [{ name: 'All Files', extensions: ['*'] }],
  });
  return result.filePaths;
});

ipcMain.handle('fetch', async () => {
  console.log('fetching');
});

ipcMain.handle('pull', async () => {
  console.log('pulling');
});

ipcMain.handle('push', async () => {
  console.log('pushing');
});

ipcMain.handle('stash', async () => {
  console.log('stashing');
});

ipcMain.handle('add-branch', async () => {
  console.log('adding branch');
});
