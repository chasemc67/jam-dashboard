interface ImportMetaEnv {
  readonly JAM_DESKTOP: boolean;
  readonly JAM_AGENT: boolean;
}

interface Window {
  jamDesktop?: import('./types/analyzer').DesktopAPI;
  jamAgent?: import('./agent/bridge').DesktopAgentAPI;
}
