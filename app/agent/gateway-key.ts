export const GATEWAY_KEYCHAIN_SERVICE = 'Jam Dashboard';
export const GATEWAY_KEYCHAIN_ACCOUNT = 'AI_GATEWAY_API_KEY';

export const AI_GATEWAY_KEYS_URL =
  'https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai-gateway%2Fapi-keys';
export const AI_GATEWAY_AUTH_DOCS_URL =
  'https://vercel.com/docs/ai-gateway/authentication';

/** Required on desktop agent API calls so cross-origin frames (e.g. YouTube) can't reach them without a CORS preflight. */
export const DESKTOP_AGENT_REQUEST_HEADER = 'X-Jam-Agent-Request';

export const GATEWAY_KEY_MISSING_MESSAGE =
  'Add your Vercel AI Gateway key to use Agent chat and voice.';
export const GATEWAY_KEY_REJECTED_MESSAGE =
  'The AI Gateway rejected your API key. Replace the key and try again.';
export const GATEWAY_KEY_INVALID_MESSAGE =
  'That does not look like an AI Gateway API key. Paste the whole key (it usually starts with vck_).';

export type GatewayKeySource = 'keychain' | 'environment';

export type GatewayKeyStatus = {
  configured: boolean;
  source: GatewayKeySource | null;
  service: string;
  account: string;
  error?: string;
};

export type GatewayKeyResult =
  | { ok: true; status: GatewayKeyStatus }
  | { ok: false; error: string; status: GatewayKeyStatus };

/** Exposed to the renderer by the desktop preload. It never returns the key itself. */
export interface DesktopGatewayKeyAPI {
  getStatus(): Promise<GatewayKeyStatus>;
  save(key: string): Promise<GatewayKeyResult>;
  clear(): Promise<GatewayKeyResult>;
}

// Restricting to token characters keeps the key safe to pass to `security -i` without escaping.
const GATEWAY_KEY_PATTERN = /^[A-Za-z0-9._~+/=-]{16,512}$/;

export function normalizeGatewayKey(value: unknown) {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!GATEWAY_KEY_PATTERN.test(key)) {
    return { ok: false as const, error: GATEWAY_KEY_INVALID_MESSAGE };
  }
  return { ok: true as const, key };
}

export function isGatewayKeyError(message: string | undefined | null) {
  return (
    !!message &&
    (message === GATEWAY_KEY_MISSING_MESSAGE ||
      message === GATEWAY_KEY_REJECTED_MESSAGE)
  );
}
