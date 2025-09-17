import { contextBridge, ipcRenderer } from 'electron';

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
} as AuthAPI);

declare global {
  interface Window {
    authAPI: AuthAPI;
  }
}
