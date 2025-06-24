import { ipcMain } from 'electron';
import {
  writeFileSync,
  readFileSync,
  WriteFileOptions,
  existsSync,
  mkdir,
} from 'fs';
import { homedir } from 'os';

const dir = `${homedir()}/.OpenGit`;

ipcMain.handle('get-repositories', async (): Promise<any> => {
  try {
    return readFileSync(`${dir}/repositories.json`, 'utf8');
  } catch (err) {
    return '[]';
  }
});

ipcMain.handle('save-repositories', async (_event, data): Promise<void> => {
  console.log(data);
  try {
    if (!existsSync(dir)) {
      console.log('creating dir');
      mkdir(dir, { recursive: true }, (err) => console.error(err));
    }
    writeFileSync(`${dir}/repositories.json`, JSON.stringify(data), {
      encoding: 'utf8',
      flag: 'w+',
    } as WriteFileOptions);
  } catch (err) {
    /* empty */
  }
});
