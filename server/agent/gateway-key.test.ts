import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createGatewayKeyManager,
  createKeychainStore,
  runSecurityCommand,
  type RunSecurity,
} from './gateway-key';
import {
  GATEWAY_KEY_INVALID_MESSAGE,
  GATEWAY_KEYCHAIN_ACCOUNT,
  GATEWAY_KEYCHAIN_SERVICE,
} from '../../app/agent/gateway-key';

const key = `vck_${'Q7w8E9r0'.repeat(6)}`;
const otherKey = `vck_${'Z1x2C3v4'.repeat(6)}`;

function splitCommand(line: string) {
  return [...line.matchAll(/"([^"]*)"|(\S+)/g)].map(m => m[1] ?? m[2]);
}

/** Emulates the subset of macOS `security` used by the store. */
function fakeSecurity({ interactive = true } = {}) {
  const items = new Map<string, string>();
  const calls: { args: string[]; input?: string }[] = [];
  const option = (args: string[], flag: string) => args[args.indexOf(flag) + 1];
  const id = (args: string[]) => `${option(args, '-s')}|${option(args, '-a')}`;
  const run: RunSecurity = async (args, input) => {
    calls.push({ args, input });
    if (args[0] === '-i') {
      if (!interactive) return { code: 0, stdout: '', stderr: '' };
      for (const line of (input ?? '').split('\n').filter(Boolean))
        dispatch(splitCommand(line));
      return { code: 0, stdout: 'security> ', stderr: '' };
    }
    return dispatch(args);
  };
  const dispatch = (args: string[]) => {
    const [command] = args;
    if (command === 'find-generic-password') {
      const value = items.get(id(args));
      return value === undefined
        ? {
            code: 44,
            stdout: '',
            stderr: 'The specified item could not be found in the keychain.\n',
          }
        : { code: 0, stdout: `${value}\n`, stderr: '' };
    }
    if (command === 'add-generic-password') {
      if (items.has(id(args)) && !args.includes('-U'))
        return { code: 45, stdout: '', stderr: 'already exists' };
      items.set(id(args), option(args, '-w'));
      return { code: 0, stdout: '', stderr: '' };
    }
    if (command === 'delete-generic-password') {
      if (!items.delete(id(args))) return { code: 44, stdout: '', stderr: '' };
      return { code: 0, stdout: '', stderr: '' };
    }
    return { code: 1, stdout: '', stderr: 'unknown command' };
  };
  return { run, items, calls };
}

test('keychain store saves via stdin, reads, replaces, and clears', async () => {
  const security = fakeSecurity();
  const store = createKeychainStore({ run: security.run });
  assert.equal(await store.read(), null);
  await store.write(`  ${key}\n`);
  assert.equal(await store.read(), key);
  assert.equal(
    security.items.get(
      `${GATEWAY_KEYCHAIN_SERVICE}|${GATEWAY_KEYCHAIN_ACCOUNT}`,
    ),
    key,
  );
  assert.ok(
    security.calls.every(call => !call.args.some(arg => arg.includes(key))),
    'the key must never be passed as a process argument when -i works',
  );
  await store.write(otherKey);
  assert.equal(await store.read(), otherKey);
  await store.clear();
  assert.equal(await store.read(), null);
  await store.clear();
});

test('keychain store falls back to arguments when interactive mode does not save', async () => {
  const security = fakeSecurity({ interactive: false });
  const store = createKeychainStore({ run: security.run });
  await store.write(key);
  assert.equal(await store.read(), key);
});

test('keychain store rejects malformed keys before calling security', async () => {
  const security = fakeSecurity();
  const store = createKeychainStore({ run: security.run });
  await assert.rejects(store.write('not a key'), {
    message: GATEWAY_KEY_INVALID_MESSAGE,
  });
  assert.equal(security.calls.length, 0);
});

test('keychain store reports errors without leaking stdout', async () => {
  const store = createKeychainStore({
    run: async () => ({
      code: 51,
      stdout: key,
      stderr: 'User interaction is not allowed.\n',
    }),
  });
  await assert.rejects(store.read(), (error: Error) => {
    assert.match(error.message, /User interaction is not allowed/);
    assert.ok(!error.message.includes(key));
    return true;
  });
});

test('runSecurityCommand spawns the executable with stdin and no inherited secrets', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'jam-security-'));
  try {
    const bin = join(dir, 'security');
    await writeFile(
      bin,
      `#!/bin/bash
printf '%s\\n' "$*" >> "${dir}/argv.log"
env >> "${dir}/env.log"
if [ "$1" = "-i" ]; then cat > "${dir}/stdin.log"; exit 0; fi
echo "found-$2"
`,
    );
    await chmod(bin, 0o755);
    process.env.AI_GATEWAY_API_KEY = key;
    const run = runSecurityCommand(bin, 5_000);
    const found = await run(['find-generic-password', 'x']);
    assert.deepEqual(found, { code: 0, stdout: 'found-x\n', stderr: '' });
    await run(['-i'], `add-generic-password -w ${otherKey}\n`);
    assert.equal(
      await readFile(join(dir, 'stdin.log'), 'utf8'),
      `add-generic-password -w ${otherKey}\n`,
    );
    const argv = await readFile(join(dir, 'argv.log'), 'utf8');
    assert.ok(!argv.includes(otherKey));
    const env = await readFile(join(dir, 'env.log'), 'utf8');
    assert.ok(!env.includes('AI_GATEWAY_API_KEY'));
  } finally {
    delete process.env.AI_GATEWAY_API_KEY;
    await rm(dir, { recursive: true, force: true });
  }
});

test('packaged apps prefer Keychain and fall back to env', async () => {
  const security = fakeSecurity();
  const keychain = createKeychainStore({ run: security.run });
  const manager = createGatewayKeyManager({
    keychain,
    env: { AI_GATEWAY_API_KEY: otherKey },
    preferEnvironment: false,
  });
  assert.deepEqual(await manager.resolve(), {
    key: otherKey,
    source: 'environment',
  });
  await keychain.write(key);
  assert.deepEqual(await manager.resolve(), { key, source: 'keychain' });
});

test('development env overrides Keychain', async () => {
  const security = fakeSecurity();
  const keychain = createKeychainStore({ run: security.run });
  await keychain.write(key);
  const manager = createGatewayKeyManager({
    keychain,
    env: { AI_GATEWAY_API_KEY: otherKey },
    preferEnvironment: true,
  });
  assert.deepEqual(await manager.resolve(), {
    key: otherKey,
    source: 'environment',
  });
});

test('manager status, save, and clear never return the key', async () => {
  const security = fakeSecurity();
  const manager = createGatewayKeyManager({
    keychain: createKeychainStore({ run: security.run }),
    env: {},
    preferEnvironment: false,
  });
  const empty = {
    configured: false,
    source: null,
    service: GATEWAY_KEYCHAIN_SERVICE,
    account: GATEWAY_KEYCHAIN_ACCOUNT,
  };
  assert.deepEqual(await manager.status(), empty);
  const invalid = await manager.save('nope');
  assert.deepEqual(invalid, {
    ok: false,
    error: GATEWAY_KEY_INVALID_MESSAGE,
    status: empty,
  });
  const saved = await manager.save(key);
  assert.deepEqual(saved, {
    ok: true,
    status: { ...empty, configured: true, source: 'keychain' },
  });
  assert.ok(!JSON.stringify(saved).includes(key));
  assert.deepEqual(await manager.clear(), { ok: true, status: empty });
});

test('manager status surfaces Keychain read failures', async () => {
  const manager = createGatewayKeyManager({
    keychain: {
      read: async () => {
        throw new Error('Keychain could not read the key: denied.');
      },
      write: async () => {},
      clear: async () => {},
    },
    env: {},
    preferEnvironment: false,
  });
  assert.equal(
    (await manager.status()).error,
    'Keychain could not read the key: denied.',
  );
});
