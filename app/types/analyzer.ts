/** Shared renderer/preload contract. Native key labels and selection values are distinct. */
export interface SongAnalysis {
  bpm: number;
  musicalKey: string;
  tempoConfidence: number;
  keyConfidence: number;
  keyScale: string | null;
  relativeMajorKey: string | null;
  relativeMajorKeyScale: string | null;
}

export interface AnalyzerState {
  revision: number;
  status:
    | 'idle'
    | 'downloading'
    | 'analyzing'
    | 'complete'
    | 'error'
    | 'cancelled';
  destination: string;
  tools: { ytDlp: boolean; ffmpeg: boolean };
  file: { path: string; name: string } | null;
  analysis: SongAnalysis | null;
  error: string | null;
}

export interface AnalyzerReply {
  ok: boolean;
  error?: string;
}

export interface DesktopAPI {
  getAnalyzerState: () => Promise<AnalyzerState>;
  startYouTube: (url: string) => Promise<AnalyzerReply>;
  chooseAudio: () => Promise<AnalyzerReply>;
  analyzeDroppedFile: (file: File) => Promise<AnalyzerReply>;
  chooseDestination: () => Promise<AnalyzerReply>;
  cancelAnalysis: () => Promise<AnalyzerReply>;
  revealAudio: () => Promise<AnalyzerReply>;
  onAnalyzerState: (callback: (state: AnalyzerState) => void) => () => void;
}
