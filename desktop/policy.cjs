const path = require('node:path');
const { createHash } = require('node:crypto');

const APP_URL = 'jam://dashboard/';
const ROUTES = new Set(['/', '/listen', '/theme']);

function isAppURL(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'jam:' &&
      url.hostname === 'dashboard' &&
      !url.port &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function isExternalURL(value) {
  try {
    return ['https:', 'http:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function assetPath(value, root) {
  if (!isAppURL(value)) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(value).pathname);
  } catch {
    return null;
  }
  if (pathname.includes('\0') || pathname.includes('\\')) return null;
  if (ROUTES.has(pathname.replace(/\/$/, '') || '/'))
    return path.join(root, 'index.html');
  const candidate = path.resolve(root, `.${pathname}`);
  return candidate.startsWith(`${path.resolve(root)}${path.sep}`)
    ? candidate
    : null;
}

function contentSecurityPolicy(html) {
  // Remix's static hydration scripts are inline. Trust their exact build output.
  const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .filter(([, body]) => body.trim())
    .map(
      ([, body]) =>
        `'sha256-${createHash('sha256').update(body).digest('base64')}'`,
    );
  return [
    "default-src 'self'",
    `script-src 'self' blob: ${hashes.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    'frame-src https://www.youtube.com',
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
}

module.exports = {
  APP_URL,
  isAppURL,
  isExternalURL,
  assetPath,
  contentSecurityPolicy,
};
