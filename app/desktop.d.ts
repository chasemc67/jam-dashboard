interface ImportMetaEnv {
  readonly JAM_DESKTOP: boolean;
}

interface Window {
  jamDesktop?: {
    openAnalyzer: () => Promise<{ ok: boolean; error?: string }>;
  };
}
