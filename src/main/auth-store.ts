// auth-store.ts// main/auth-store.ts
import { app, ipcMain, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';

const TOKENS_PATH = path.join(app.getPath('userData'), 'tokens.bin');

type Vault = Record<string, { host: string; account: string; enc: string }>;
const key = (host: string, account: string) => `${host}:${account}`;

function readVault(): Vault {
  if (!fs.existsSync(TOKENS_PATH)) return {};
  const decrypted = safeStorage.decryptString(fs.readFileSync(TOKENS_PATH));
  return JSON.parse(decrypted);
}
function writeVault(vault: Vault) {
  const blob = safeStorage.encryptString(JSON.stringify(vault));
  fs.writeFileSync(TOKENS_PATH, Buffer.from(blob));
}

export function saveToken(host: string, account: string, token: string) {
  const vault = readVault();
  vault[key(host, account)] = {
    host,
    account,
    enc: safeStorage.encryptString(token).toString(),
  };
  writeVault(vault);
}
export function loadToken(host: string, account: string) {
  const vault = readVault();
  const entry = vault[key(host, account)];
  if (!entry) return null;
  return safeStorage.decryptString(Buffer.from(entry.enc));
}
export function deleteToken(host: string, account: string) {
  const vault = readVault();
  delete vault[key(host, account)];
  writeVault(vault);
}
export function listAccounts(host: string) {
  const vault = readVault();
  return Object.values(vault)
    .filter(v => v.host === host)
    .map(v => v.account)
    .sort();
}

