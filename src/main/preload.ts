// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels =
  | 'open-file-dialog'
  | 'fetch'
  | 'pull'
  | 'push'
  | 'stash'
  | 'add-branch'
  | 'get-repo-path'
  | 'list-branches'
  | 'checkout-branch'
  | 'get-branch-commits'
  | 'set-selected-repository'
  | 'stage-file'
  | 'unstage-file'
  | 'list-changes'
  | 'commit'
  | 'list-staged'
  | 'list-stashes'
  | 'use-stash'
  | 'get-branch'
  | 'get-branch-revs'
  | 'delete-branch'
  | 'get-diff'
  | 'stage-lines'
  | 'discard-file'
  | 'discard-lines'
  | 'get-repositories'
  | 'merge-branch'
  | 'save-repositories';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    invoke(channel: Channels, ...args: unknown[]) {
      return ipcRenderer.invoke(channel, ...args);
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
