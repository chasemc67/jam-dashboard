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
};

function defineTool<S extends z.ZodObject>(
  name: string,
  description: string,
  inputSchema: S,
  readOnly: boolean,
  run: (input: z.output<S>, host: ToolHost) => unknown | Promise<unknown>,
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
    () => ({
      version: 1,
      requiresScaleForVisualization: true,
      stringOrder:
        'String 1 is the high/top string. Tuning and voicing arrays run high to low.',
      theoryWorksWithoutConnectedApp: true,
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
