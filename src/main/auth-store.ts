import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
// main/ipc-auth.ts (replace the vault section)

const TOKENS_PATH = path.join(app.getPath('userData'), 'tokens.bin');

type VaultEntry = {
  host: string;
  account: string;
  enc_b64: string; // <- base64 of safeStorage.encryptString(token)
  type: 'oauth';
  provider: 'github' | 'bitbucket';
};
type Vault = Record<string, VaultEntry>;
const key = (host: string, account: string) => `${host}:${account}`;

export function readVault(): Vault {
  if (!fs.existsSync(TOKENS_PATH)) return {};
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage encryption is not available on this system');
  }
  const raw = fs.readFileSync(TOKENS_PATH);
  try {
    const decrypted = safeStorage.decryptString(raw);
    return JSON.parse(decrypted);
  } catch (e) {
    // Try to see if it was accidentally written as plaintext JSON (legacy)
    try {
      const maybeJson = JSON.parse(raw.toString('utf8'));
      // If this succeeds, re-encrypt on next write
      return maybeJson as Vault;
    } catch {
      // Corrupt or foreign-user file → quarantine and start fresh
      const bak = `${TOKENS_PATH}.corrupt-${Date.now()}`;
      try {
        fs.renameSync(TOKENS_PATH, bak);
      } catch {}
      return {};
    }
  }
}

export function writeVault(vault: Vault) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage encryption is not available on this system');
  }
  const payload = JSON.stringify(vault);
  const cipher = safeStorage.encryptString(payload); // Buffer
  fs.writeFileSync(TOKENS_PATH, cipher); // write bytes as-is
}

export function saveOAuth(
  host: string,
  provider: 'github' | 'bitbucket',
  account: string,
  token: string,
) {
  const vault = readVault();
  const encBuf = safeStorage.encryptString(token); // Buffer
  vault[key(host, account)] = {
    host,
    account,
    enc_b64: encBuf.toString('base64'), // <- base64
    type: 'oauth',
    provider,
  };
  writeVault(vault);
}

export function loadToken(
  host: string,
  account: string,
): { token: string; provider: 'github' | 'bitbucket' } | null {
  const vault = readVault();
  const entry = vault[key(host, account)];
  if (!entry) return null;

  // Handle both new (enc_b64) and very old (enc) shapes for migration
  const encB64 = (entry as any).enc_b64 ?? (entry as any).enc;
  if (!encB64) return null;

  try {
    const buf = Buffer.from(encB64, 'base64');
    const token = safeStorage.decryptString(buf);
    return { token, provider: entry.provider };
  } catch {
    // Last-ditch: if older code stored raw Buffer.toString() (utf8), try without base64
    try {
      const token = safeStorage.decryptString(Buffer.from(encB64));
      return { token, provider: entry.provider };
    } catch {
      return null;
    }
  }
}

export function deleteToken(host: string, account: string) {
  const vault = readVault();
  delete vault[key(host, account)];
  writeVault(vault);
}
