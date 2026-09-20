import { z } from 'zod/v4';
import {
  FindVoicingsSchema,
  NoteListSchema,
  SelectVoicingSchema,
  SetViewSchema,
  ShowFretboardSchema,
  ShowVoicingsSchema,
  type ToolHost,
} from './contract';
import { getChord, getScale, identifyChord, ToolError } from '../music/theory';
import { findVoicings } from '../music/voicings';
import { AppStateSchema } from './wire';
import { callSongAnalyzer, SongAnalysisSnapshotSchema } from './song-analysis';

const target = {
  sessionId: z
    .string()
    .max(100)
    .optional()
    .describe(
      'Required when more than one app window/tab is connected; obtain from list_sessions.',
    ),
  expectedRevision: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      'Optionally reject the change if the user edited the view since get_state.',
    ),
};
const stateTarget = z.strictObject({ sessionId: target.sessionId });
export const ToolOutputSchema = z.strictObject({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.strictObject({ code: z.string(), message: z.string() }).optional(),
});
const VoicingResultSchema = AppStateSchema.shape.display.shape.result.unwrap();
const ChordResultSchema = VoicingResultSchema.shape.chord;
const resultSchemas: Record<string, z.ZodType> = {
  get_capabilities: z.strictObject({
    version: z.literal(1),
    requiresScaleForVisualization: z.boolean(),
    stringOrder: z.string(),
    theoryWorksWithoutConnectedApp: z.boolean(),
    songAnalysis: z.strictObject({
      available: z.boolean(),
      desktopOnly: z.literal(true),
      accepts: z.array(z.string()),
      requiredTools: z.array(z.string()),
      workflow: z.string(),
    }),
    voicings: z.strictObject({
      tuning: z.string(),
      defaultFrets: z.array(z.number()).length(2),
      maxFrets: z.number(),
      defaultMaxSpan: z.number(),
      maxResults: z.number(),
      bounded: z.boolean(),
    }),
    caged: z.string(),
    workflow: z.string(),
  }),
  list_sessions: z.strictObject({
    sessions: z.array(
      z.strictObject({
        id: z.string(),
        platform: z.enum(['desktop', 'chrome']),
        title: z.string(),
        revision: z.number(),
        viewReady: z.boolean(),
      }),
    ),
  }),
  get_state: AppStateSchema,
  identify_chord: z.strictObject({
    notes: z.array(z.string()),
    bass: z.string(),
    candidates: z.array(ChordResultSchema),
    interpretation: z.string(),
  }),
  get_chord: ChordResultSchema,
  get_scale: z.strictObject({
    name: z.string(),
    tonic: z.string(),
    type: z.string(),
    notes: z.array(z.string()),
    intervals: z.array(z.string()),
    pentatonicNotes: z.array(z.string()),
  }),
  find_voicings: VoicingResultSchema,
  set_view: AppStateSchema,
  show_fretboard: AppStateSchema,
  show_voicings: AppStateSchema,
  select_voicing: AppStateSchema,
  analyze_song: SongAnalysisSnapshotSchema,
  get_song_analysis: SongAnalysisSnapshotSchema,
  cancel_song_analysis: SongAnalysisSnapshotSchema,
};

function defineTool<S extends z.ZodObject>(
  name: string,
  description: string,
  inputSchema: S,
  readOnly: boolean,
  run: (input: z.output<S>, host: ToolHost) => unknown | Promise<unknown>,
  annotations: { idempotentHint?: boolean; openWorldHint?: boolean } = {},
) {
  return {
    name,
    description,
    inputSchema,
    outputSchema: ToolOutputSchema.extend({
      data: resultSchemas[name].optional(),
    }),
    annotations: {
      readOnlyHint: readOnly,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
      ...annotations,
    },
    async execute(input: unknown, host: ToolHost) {
      try {
        return { ok: true, data: await run(inputSchema.parse(input), host) };
      } catch (error) {
        return { ok: false, error: serializeError(error) };
      }
    },
  };
}

export function serializeError(error: unknown) {
  if (error instanceof ToolError)
    return { code: error.code, message: error.message };
  if (error instanceof z.ZodError)
    return {
      code: 'INVALID_INPUT',
      message: error.issues
        .map(i => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    };
  return {
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : 'The operation failed.',
  };
}

export const agentTools = [
  defineTool(
    'get_capabilities',
    'Describe the supported music and visualization operations and V1 limits.',
    z.strictObject({}),
    true,
    (_i, h) => ({
      version: 1,
      requiresScaleForVisualization: true,
      stringOrder:
        'String 1 is the high/top string. Tuning and voicing arrays run high to low.',
      theoryWorksWithoutConnectedApp: true,
      songAnalysis: {
        available: Boolean(h.songAnalyzer),
        desktopOnly: true as const,
        accepts: ['song name and artist', 'YouTube URL'],
        requiredTools: ['yt-dlp', 'ffmpeg'],
        workflow:
          'analyze_song returns a jobId immediately. Poll get_song_analysis with that jobId every few seconds until complete, error, or cancelled. Completed analysis contains estimated BPM, key, confidence, and keyScale. Apply keyScale with set_view only if asked. cancel_song_analysis requires the jobId. Jobs use the desktop app and its configured download folder; no scale selection is required.',
      },
      voicings: {
        tuning: 'six-string E standard only',
        defaultFrets: [0, 12],
        maxFrets: 24,
        defaultMaxSpan: 4,
        maxResults: 20,
        bounded: true,
      },
      caged:
        'Existing pentatonic scale coloring; not exact CAGED chord-position templates.',
      workflow:
        'list_sessions → get_state → identify_chord/get_chord → show_voicings → select_voicing. Use set_view to select a compatible scale or tuning. Tools change the visible app; they do not play audio.',
    }),
  ),
  defineTool(
    'list_sessions',
    'List connected dashboard tabs/windows. Select a session explicitly if multiple are connected.',
    z.strictObject({}),
    true,
    (_i, h) => ({ sessions: h.listSessions() }),
  ),
  defineTool(
    'get_state',
    'Read the committed app view, selected scale, tuning, highlights, voicing results and revision.',
    stateTarget,
    true,
    (i, h) => h.getState(i.sessionId),
  ),
  defineTool(
    'identify_chord',
    'Identify possible chord names from ordered notes. First note is the bass; preserves ambiguity and enharmonic equivalence. Does not change the app.',
    z.strictObject({ notes: NoteListSchema }),
    true,
    i => identifyChord(i.notes),
  ),
  defineTool(
    'get_chord',
    'Get chord tones and intervals from a chord symbol, including slash chords.',
    z.strictObject({ chord: z.string().min(1).max(100) }),
    true,
    i => getChord(i.chord),
  ),
  defineTool(
    'get_scale',
    'Get scale notes, intervals and the existing pentatonic mapping from a tonic and scale type.',
    z.strictObject({ scale: z.string().min(1).max(100) }),
    true,
    i => getScale(i.scale),
  ),
  defineTool(
    'find_voicings',
    'Search bounded six-string E-standard voicings without changing the app. Results explicitly indicate completeness. All chord tones required; slash bass enforced. No ergonomic ranking.',
    FindVoicingsSchema,
    true,
    i => findVoicings(i.chord, i.options),
  ),
  defineTool(
    'analyze_song',
    'Start desktop song analysis from a song name and artist or a direct YouTube URL. Names search YouTube and use the first match; URLs select an exact video. Downloads an MP3 to the app’s configured folder and estimates BPM/key locally. Returns immediately with a jobId; poll get_song_analysis every few seconds until complete/error/cancelled. Shows progress in the app; does not change the selected scale. Requires the desktop MCP endpoint, yt-dlp and ffmpeg. Only one analysis runs at a time. Do not repeat to poll or retry an uncertain start: read get_song_analysis first.',
    z.strictObject({
      query: z
        .string()
        .min(1)
        .max(4096)
        .describe(
          'Song title and artist (up to 500 characters), or an http(s) YouTube video URL.',
        ),
    }),
    false,
    (i, h) =>
      callSongAnalyzer(h.songAnalyzer, analyzer =>
        analyzer.startSongAnalysis(i.query),
      ),
    { idempotentHint: false, openWorldHint: true },
  ),
  defineTool(
    'get_song_analysis',
    'Read a desktop song-analysis job’s status, original query, matched YouTube video, BPM/key estimates and confidence, or failure message. Pass jobId from analyze_song to avoid mixing songs. Omit jobId to inspect the current job (including a manually started job) or recover after an uncertain start. Terminal statuses are complete, error, and cancelled. The last eight finished jobs are retained in memory until app restart; unknown or expired IDs return ANALYSIS_NOT_FOUND. No network requests or new downloads.',
    z.strictObject({ jobId: z.string().uuid().optional() }),
    true,
    (i, h) =>
      callSongAnalyzer(h.songAnalyzer, analyzer =>
        analyzer.getSongAnalysis(i.jobId),
      ),
  ),
  defineTool(
    'cancel_song_analysis',
    'Cancel the specified desktop analysis job and its search/download/decoder processes. Requires its jobId so a stale cancellation cannot stop a different song. Cancelling a retained completed job is a no-op. Partial downloads may remain in the app’s configured folder.',
    z.strictObject({ jobId: z.string().uuid() }),
    false,
    (i, h) =>
      callSongAnalyzer(h.songAnalyzer, analyzer =>
        analyzer.cancelSongAnalysis(i.jobId),
      ),
  ),
  defineTool(
    'set_view',
    'Change scale, tuning or view settings atomically. CAGED uses existing pentatonic coloring. Tuning is high to low. Select a scale before rendering notes.',
    SetViewSchema.extend(target),
    false,
    ({ sessionId, expectedRevision, ...input }, h) =>
      h.execute({ type: 'set_view', input }, sessionId, expectedRevision),
  ),
  defineTool(
    'show_fretboard',
    'Show scale-contained notes, a chord, or exact string/fret positions in the app. Omit all three to clear the selection. Optional scale explicitly changes the scale. Disables CAGED coloring.',
    ShowFretboardSchema.safeExtend(target),
    false,
    ({ sessionId, expectedRevision, ...input }, h) =>
      h.execute({ type: 'show_fretboard', input }, sessionId, expectedRevision),
  ),
  defineTool(
    'show_voicings',
    'Find and display chord voicings in the app. Requires a compatible selected scale and six-string E standard. Shows the first result with next/previous controls; expands visible frets if needed.',
    ShowVoicingsSchema.extend(target),
    false,
    ({ sessionId, expectedRevision, ...input }, h) =>
      h.execute({ type: 'show_voicings', input }, sessionId, expectedRevision),
  ),
  defineTool(
    'select_voicing',
    'Display one of the current voicing results by zero-based index.',
    SelectVoicingSchema.extend(target),
    false,
    ({ sessionId, expectedRevision, ...input }, h) =>
      h.execute({ type: 'select_voicing', input }, sessionId, expectedRevision),
  ),
];
