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
  | 'get-commit-log'
  | 'save-repositories'
  | "clone-repo";


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

export type AuthAPI = {
  detectRemote: () => Promise<{ host: string; url: string }>;
  load: (host: string, account: string) => Promise<string | null>;
  del: (host: string, account: string) => Promise<void>;
  test: (
    host: string,
    account: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  oauthGithub: (clientId: string, account?: string) => Promise<{ ok: true }>;
  oauthBitbucket: (clientId: string, account: string) => Promise<{ ok: true }>;
};

contextBridge.exposeInMainWorld('authAPI', {
  detectRemote: () => ipcRenderer.invoke('auth:detect-remote'),
  load: (host, account) => ipcRenderer.invoke('auth:load', host, account),
  del: (host, account) => ipcRenderer.invoke('auth:delete', host, account),
  test: (host, account) => ipcRenderer.invoke('auth:test', host, account),
  oauthGithub: (clientId, account) =>
    ipcRenderer.invoke('oauth:github', clientId, account),
  oauthBitbucket: (clientId, account) =>
    ipcRenderer.invoke('oauth:bitbucket', clientId, account),
  getIdentity: () => ipcRenderer.invoke('git:get-identity'),
  setIdentity: (name: string, email: string) =>
    ipcRenderer.invoke('git:set-identity', name, email),
} as AuthAPI);


contextBridge.exposeInMainWorld("events", {
  onClone: (cb: () => void) => ipcRenderer.on("clone", cb)
})

declare global {
  interface Window {
    authAPI: AuthAPI;
    events: {
      onClone: (cb: () => void) => () => void;
    }
  }
}

export type ElectronHandler = typeof electronHandler;
