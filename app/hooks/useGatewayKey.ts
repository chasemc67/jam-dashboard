import { useCallback, useEffect, useState } from 'react';
import type {
  DesktopGatewayKeyAPI,
  GatewayKeyResult,
  GatewayKeyStatus,
} from '~/agent/gateway-key';

export type GatewayKeyState = {
  /** True in the desktop app, where each user supplies their own AI Gateway key. */
  required: boolean;
  status: GatewayKeyStatus | null;
  refresh: () => Promise<void>;
  save: (key: string) => Promise<GatewayKeyResult>;
  clear: () => Promise<GatewayKeyResult>;
};

const unavailable = (): Promise<GatewayKeyResult> =>
  Promise.reject(new Error('Key storage is only available in the Mac app.'));

const desktopApi = () =>
  typeof window === 'undefined' ? undefined : window.jamGatewayKey;

export function useGatewayKey(
  getApi: () => DesktopGatewayKeyAPI | undefined = desktopApi,
): GatewayKeyState {
  // Resolved after mount so the prerendered SPA shell and the first client render match.
  const [api, setApi] = useState<DesktopGatewayKeyAPI>();
  const [status, setStatus] = useState<GatewayKeyStatus | null>(null);
  useEffect(() => setApi(getApi()), [getApi]);

  const refresh = useCallback(async () => {
    if (!api) return;
    setStatus(await api.getStatus());
  }, [api]);

  useEffect(() => {
    void refresh().catch(() => {});
  }, [refresh]);

  const save = useCallback(
    async (key: string) => {
      if (!api) return unavailable();
      const result = await api.save(key);
      setStatus(result.status);
      return result;
    },
    [api],
  );

  const clear = useCallback(async () => {
    if (!api) return unavailable();
    const result = await api.clear();
    setStatus(result.status);
    return result;
  }, [api]);

  return { required: Boolean(api), status, refresh, save, clear };
}
