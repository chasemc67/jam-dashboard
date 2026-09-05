interface ImportMetaEnv {
  readonly JAM_DESKTOP: boolean;
}

interface Window {
  jamDesktop?: import('./types/analyzer').DesktopAPI;
}
