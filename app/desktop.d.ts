interface ImportMetaEnv {
  readonly JAM_DESKTOP: boolean;
  readonly JAM_AGENT: boolean;
}

interface Window {
  jamRecording?: import('./components/LiveFretboard/recording').RecordingAPI;
  jamDesktop?: import('./types/analyzer').DesktopAPI;
  jamAgent?: import('./agent/bridge').DesktopAgentAPI;
  jamGatewayKey?: import('./agent/gateway-key').DesktopGatewayKeyAPI;
  jamFretTracker?: import('./types/fretTracker').DesktopFretTrackerAPI;
}
