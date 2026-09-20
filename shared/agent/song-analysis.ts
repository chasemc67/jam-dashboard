import { z } from 'zod/v4';
import { ToolError } from '../music/theory';

export const SongAnalysisSnapshotSchema = z.strictObject({
  jobId: z.string().uuid().nullable(),
  status: z.enum([
    'idle',
    'searching',
    'downloading',
    'analyzing',
    'complete',
    'error',
    'cancelled',
  ]),
  query: z.string().max(4096).nullable(),
  source: z
    .strictObject({
      title: z.string().min(1).max(1024),
      url: z.string().url(),
      channel: z.string().max(1024).nullable(),
      duration: z.number().nonnegative().nullable(),
    })
    .nullable(),
  analysis: z
    .strictObject({
      bpm: z.number().positive().max(1000),
      musicalKey: z.string().max(80),
      tempoConfidence: z.number().min(0).max(1),
      keyConfidence: z.number().min(0).max(1),
      keyScale: z.string().nullable(),
      relativeMajorKey: z.string().nullable(),
      relativeMajorKeyScale: z.string().nullable(),
    })
    .nullable(),
  error: z.string().nullable(),
});
export type SongAnalysisSnapshot = z.infer<typeof SongAnalysisSnapshotSchema>;

/** A host-provided local analyzer; browsers do not gain native process access. */
export interface SongAnalyzerHost {
  startSongAnalysis(
    query: string,
  ): SongAnalysisSnapshot | Promise<SongAnalysisSnapshot>;
  getSongAnalysis(
    jobId?: string,
  ): SongAnalysisSnapshot | Promise<SongAnalysisSnapshot>;
  cancelSongAnalysis(
    jobId: string,
  ): SongAnalysisSnapshot | Promise<SongAnalysisSnapshot>;
}

export async function callSongAnalyzer(
  host: SongAnalyzerHost | undefined,
  run: (
    analyzer: SongAnalyzerHost,
  ) => SongAnalysisSnapshot | Promise<SongAnalysisSnapshot>,
) {
  if (!host)
    throw new ToolError(
      'ANALYZER_UNAVAILABLE',
      'Song analysis requires the Jam Dashboard desktop MCP endpoint. Connect to the MCP address shown in the desktop app; web-only endpoints cannot download or analyze audio.',
    );
  try {
    const parsed = SongAnalysisSnapshotSchema.safeParse(await run(host));
    if (!parsed.success)
      throw new ToolError(
        'INVALID_REPLY',
        'The song analyzer returned an invalid job snapshot.',
      );
    return parsed.data;
  } catch (error) {
    // Desktop and server bundles can have distinct Error subclasses. Only pass
    // through the small set of analyzer errors that form the public contract.
    if (
      error instanceof Error &&
      'code' in error &&
      typeof error.code === 'string' &&
      [
        'ANALYSIS_NOT_FOUND',
        'ANALYZER_BUSY',
        'INVALID_INPUT',
        'DEPENDENCY_MISSING',
        'ANALYSIS_FAILED',
      ].includes(error.code)
    )
      throw new ToolError(error.code, error.message);
    throw error;
  }
}
