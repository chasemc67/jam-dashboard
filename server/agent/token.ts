import { mkdir, open, readFile, chmod } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

export async function loadAgentToken(file: string) {
  await mkdir(dirname(file), { recursive: true });
  try {
    const handle = await open(file, 'wx', 0o600);
    try {
      await handle.writeFile(randomBytes(32).toString('hex'));
    } finally {
      await handle.close();
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  const token = (await readFile(file, 'utf8')).trim();
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new Error(`Invalid agent token file: ${file}`);
  await chmod(file, 0o600);
  return token;
}
