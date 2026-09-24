import { spawn } from 'node:child_process';
import {
  GATEWAY_KEYCHAIN_ACCOUNT,
  GATEWAY_KEYCHAIN_SERVICE,
  normalizeGatewayKey,
  type GatewayKeyResult,
  type GatewayKeySource,
  type GatewayKeyStatus,
} from '../../app/agent/gateway-key';

export const SECURITY_PATH = '/usr/bin/security';
/** `security` exits with errSecItemNotFound's low byte when no matching item exists. */
const ITEM_NOT_FOUND = 44;

export type SecurityResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};
export type RunSecurity = (
  args: string[],
  input?: string,
) => Promise<SecurityResult>;

export function runSecurityCommand(
  securityPath = SECURITY_PATH,
  timeoutMs = 120_000,
): RunSecurity {
  return (args, input) =>
    new Promise((resolve, reject) => {
      const child = spawn(securityPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          PATH: '/usr/bin:/bin',
          HOME: process.env.HOME ?? '',
        } as Partial<NodeJS.ProcessEnv> as NodeJS.ProcessEnv,
      });
      let stdout = '';
      let stderr = '';
      // Keychain may show an access prompt, so allow time for the user to answer it.
      const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
      child.stdout.setEncoding('utf8').on('data', chunk => (stdout += chunk));
      child.stderr.setEncoding('utf8').on('data', chunk => (stderr += chunk));
      child.on('error', error => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', code => {
        clearTimeout(timer);
        resolve({ code, stdout, stderr });
      });
      child.stdin.on('error', () => {});
      child.stdin.end(input ?? '');
    });
}

export type KeychainStore = {
  read(): Promise<string | null>;
  write(key: string): Promise<void>;
  clear(): Promise<void>;
};

function failure(action: string, result: SecurityResult) {
  const detail = result.stderr.trim().split('\n')[0];
  return new Error(
    `Keychain could not ${action} the key${detail ? `: ${detail}` : ` (exit ${result.code})`}.`,
  );
}

export function createKeychainStore({
  run,
  service = GATEWAY_KEYCHAIN_SERVICE,
  account = GATEWAY_KEYCHAIN_ACCOUNT,
}: {
  run: RunSecurity;
  service?: string;
  account?: string;
}): KeychainStore {
  if (/["\\\n]/.test(service + account))
    throw new Error('Keychain service and account must not need escaping.');
  const identity = ['-s', service, '-a', account];
  const label = `${service} AI Gateway key`;

  async function read() {
    const result = await run(['find-generic-password', ...identity, '-w']);
    if (result.code === ITEM_NOT_FOUND) return null;
    if (result.code !== 0) throw failure('read', result);
    return result.stdout.trim() || null;
  }

  return {
    read,
    async write(value) {
      const normalized = normalizeGatewayKey(value);
      if (!normalized.ok) throw new Error(normalized.error);
      const { key } = normalized;
      // Interactive mode reads the command from stdin so the key never appears in the process list.
      await run(
        ['-i'],
        `add-generic-password -U -s "${service}" -a "${account}" -l "${label}" -w ${key}\n`,
      );
      if ((await read()) === key) return;
      const result = await run([
        'add-generic-password',
        '-U',
        ...identity,
        '-l',
        label,
        '-w',
        key,
      ]);
      if (result.code !== 0) throw failure('save', result);
      if ((await read()) !== key)
        throw new Error('Keychain did not save the key. Try again.');
    },
    async clear() {
      // Remove duplicates too, e.g. an item also added by hand in Keychain Access.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const result = await run(['delete-generic-password', ...identity]);
        if (result.code === ITEM_NOT_FOUND) return;
        if (result.code !== 0) throw failure('remove', result);
      }
    },
  };
}

type Env = Record<string, string | undefined>;

export async function resolveGatewayKey({
  keychain,
  env,
  preferEnvironment,
}: {
  keychain: KeychainStore;
  env: Env;
  preferEnvironment: boolean;
}): Promise<{ key: string | null; source: GatewayKeySource | null }> {
  const fromEnv = env.AI_GATEWAY_API_KEY?.trim() || null;
  if (preferEnvironment && fromEnv)
    return { key: fromEnv, source: 'environment' };
  let stored: string | null;
  try {
    stored = await keychain.read();
  } catch (error) {
    if (fromEnv) return { key: fromEnv, source: 'environment' };
    throw error;
  }
  if (stored) return { key: stored, source: 'keychain' };
  if (fromEnv) return { key: fromEnv, source: 'environment' };
  return { key: null, source: null };
}

export type GatewayKeyManager = ReturnType<typeof createGatewayKeyManager>;

/**
 * Keychain first for packaged apps; `AI_GATEWAY_API_KEY` in the process env wins in
 * development (`preferEnvironment`). Status and results never include the key.
 */
export function createGatewayKeyManager({
  keychain,
  env,
  preferEnvironment,
  service = GATEWAY_KEYCHAIN_SERVICE,
  account = GATEWAY_KEYCHAIN_ACCOUNT,
}: {
  keychain: KeychainStore;
  env: Env;
  preferEnvironment: boolean;
  service?: string;
  account?: string;
}) {
  const resolve = () => resolveGatewayKey({ keychain, env, preferEnvironment });
  async function status(): Promise<GatewayKeyStatus> {
    try {
      const { key, source } = await resolve();
      return { configured: Boolean(key), source, service, account };
    } catch (error) {
      return {
        configured: false,
        source: null,
        service,
        account,
        error: (error as Error).message,
      };
    }
  }
  async function change(
    action: () => Promise<void>,
  ): Promise<GatewayKeyResult> {
    try {
      await action();
      return { ok: true, status: await status() };
    } catch (error) {
      return {
        ok: false,
        error: (error as Error).message,
        status: await status(),
      };
    }
  }
  return {
    resolve,
    status,
    save: (value: unknown) =>
      change(async () => {
        const normalized = normalizeGatewayKey(value);
        if (!normalized.ok) throw new Error(normalized.error);
        await keychain.write(normalized.key);
      }),
    clear: () => change(() => keychain.clear()),
  };
}
