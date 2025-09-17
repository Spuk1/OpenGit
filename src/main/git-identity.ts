// main/git-identity.ts
import * as git from 'isomorphic-git';
import fs from 'fs';

export async function getIdentity(dir: string) {
  const name = await git.getConfig({ fs, dir, path: 'user.name' });
  const email = await git.getConfig({ fs, dir, path: 'user.email' });
  return { name: name ?? '', email: email ?? '' };
}

export async function setIdentity(dir: string, name: string, email: string) {
  await git.setConfig({ fs, dir, path: 'user.name', value: name });
  await git.setConfig({ fs, dir, path: 'user.email', value: email });
}

export async function ensureIdentity(dir: string) {
  const { name, email } = await getIdentity(dir);
  if (!name || !email) {
    const missing = [!name ? 'user.name' : null, !email ? 'user.email' : null]
      .filter(Boolean)
      .join(' and ');
    throw new Error(
      `Git identity missing: ${missing}. Please set it in Settings.`,
    );
  }
}
