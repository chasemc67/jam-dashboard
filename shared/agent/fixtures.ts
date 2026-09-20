import type { AppState } from './contract';
export function initialState(): AppState {
  return {
    protocolVersion: 1,
    revision: 1,
    viewReady: true,
    scale: 'C major',
    scaleNotes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    tuning: ['E', 'B', 'G', 'D', 'A', 'E'],
    settings: {
      numberOfFrets: 12,
      isLefty: false,
      showTextNotes: true,
      quickColors: 'scale',
      cagedModeEnabled: false,
      cagedShape: 'C',
    },
    highlightNotes: [],
    display: { kind: 'scale' },
  };
}
