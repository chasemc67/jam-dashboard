const { readdir, readFile, stat } = require('node:fs/promises');
const path = require('node:path');

// Vercel AI Gateway keys; each user supplies their own at runtime via Keychain.
const GATEWAY_KEY = /vck_[A-Za-z0-9]{20,}/;
const SECRET_ENV = ['AI_GATEWAY_API_KEY', 'VERCEL_OIDC_TOKEN'];

function withoutSecrets(env) {
  const copy = { ...env };
  for (const name of SECRET_ENV) delete copy[name];
  return copy;
}

async function* files(target) {
  const info = await stat(target);
  if (info.isFile()) {
    yield target;
    return;
  }
  for (const entry of await readdir(target, { withFileTypes: true })) {
    yield* files(path.join(target, entry.name));
  }
}

/** Returns findings (file + reason) without echoing the secret itself. */
async function findSecrets(targets, env = process.env) {
  const literals = SECRET_ENV.map(name => [name, env[name]?.trim()]).filter(
    ([, value]) => value && value.length >= 16,
  );
  const findings = [];
  for (const target of targets) {
    for await (const file of files(target)) {
      const text = (await readFile(file)).toString('latin1');
      for (const [name, value] of literals)
        if (text.includes(value))
          findings.push({ file, reason: `contains the value of ${name}` });
      if (GATEWAY_KEY.test(text))
        findings.push({ file, reason: 'contains an AI Gateway key' });
    }
  }
  return findings;
}

module.exports = { findSecrets, withoutSecrets, SECRET_ENV };
