import {
  GATEWAY_KEY_INVALID_MESSAGE,
  GATEWAY_KEY_MISSING_MESSAGE,
  GATEWAY_KEY_REJECTED_MESSAGE,
  isGatewayKeyError,
  normalizeGatewayKey,
} from './gateway-key';

const key = `vck_${'A1b2C3d4'.repeat(6)}`;

test('accepts and trims AI Gateway keys', () => {
  expect(normalizeGatewayKey(`  ${key}\n`)).toEqual({ ok: true, key });
});

test('rejects empty, short, whitespace, and quote-bearing values', () => {
  for (const value of [
    undefined,
    '',
    'vck_short',
    `${key} extra`,
    `${key}"`,
    `${key}\\`,
    `export AI_GATEWAY_API_KEY=${key}`,
    'x'.repeat(513),
  ]) {
    expect(normalizeGatewayKey(value)).toEqual({
      ok: false,
      error: GATEWAY_KEY_INVALID_MESSAGE,
    });
  }
});

test('recognizes key setup errors', () => {
  expect(isGatewayKeyError(GATEWAY_KEY_MISSING_MESSAGE)).toBe(true);
  expect(isGatewayKeyError(GATEWAY_KEY_REJECTED_MESSAGE)).toBe(true);
  expect(isGatewayKeyError('Jam MCP is not running.')).toBe(false);
  expect(isGatewayKeyError(undefined)).toBe(false);
});
