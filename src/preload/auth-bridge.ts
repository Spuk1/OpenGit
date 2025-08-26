import { contextBridge, ipcRenderer } from 'electron';

export type AuthAPI = {
  detectRemote: () => Promise<{ host: string; url: string }>;
  listAccounts: (host: string) => Promise<string[]>;
  save: (host: string, account: string, token: string) => Promise<void>;
  load: (host: string, account: string) => Promise<string | null>;
  del: (host: string, account: string) => Promise<void>;
  test: (
    host: string,
    account: string,
  ) => Promise<{ ok: boolean; error?: string }>;
};

const api: AuthAPI = {
  detectRemote: () => ipcRenderer.invoke('auth:detect-remote'),
  listAccounts: (host) => ipcRenderer.invoke('auth:list-accounts', host),
  save: (host, account, token) =>
    ipcRenderer.invoke('auth:save', host, account, token),
  load: (host, account) => ipcRenderer.invoke('auth:load', host, account),
  del: (host, account) => ipcRenderer.invoke('auth:delete', host, account),
  test: (host, account) => ipcRenderer.invoke('auth:test', host, account),
};

contextBridge.exposeInMainWorld('authAPI', api);

declare global {
  interface Window {
    authAPI: AuthAPI;
  }
}
