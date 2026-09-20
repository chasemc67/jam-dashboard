import { z } from 'zod/v4';
import { CommandSchema, ViewSettingsSchema } from './contract';
import { PositionSchema } from '../music/voicings';

const note = z.string().max(100);
const chord = z.strictObject({
  symbol: note,
  name: note,
  notes: z.array(note).max(12),
  intervals: z.array(note).max(12),
  bass: note.nullable(),
  quality: note,
});
const voicing = z.strictObject({
  id: note,
  frets: z.array(z.number().int().min(0).max(24).nullable()).length(6),
  positions: z.array(PositionSchema).max(6),
  notes: z.array(note).max(6),
  bass: note,
  span: z.number().min(0).max(5),
});
export const AppStateSchema = z.strictObject({
  protocolVersion: z.literal(1),
  revision: z.number().int().min(0),
  viewReady: z.boolean(),
  scale: note.nullable(),
  scaleNotes: z.array(note).max(12),
  tuning: z.array(z.string().max(12)).min(4).max(8),
  settings: ViewSettingsSchema,
  highlightNotes: z.array(note).max(12),
  display: z.strictObject({
    kind: z.enum(['scale', 'notes', 'positions', 'voicings']),
    chord: note.optional(),
    positions: z.array(PositionSchema).max(192).optional(),
    selectedIndex: z.number().int().min(0).max(19).optional(),
    result: z
      .strictObject({
        algorithmVersion: z.literal(1),
        chord,
        tuning: z.array(note).length(6),
        stringOrder: z.literal('high-to-low'),
        options: z.strictObject({
          minFret: z.number(),
          maxFret: z.number(),
          maxSpan: z.number(),
          limit: z.number(),
        }),
        voicings: z.array(voicing).max(20),
        complete: z.boolean(),
        truncated: z.boolean(),
        stopReason: z.enum(['result_limit', 'work_limit']).nullable(),
        visited: z.number(),
        nodeBudget: z.number(),
        rules: z.string().max(500),
      })
      .optional(),
  }),
});
export const CommandRequestSchema = z.strictObject({
  id: z.string().max(100),
  command: CommandSchema,
  expectedRevision: z.number().int().min(0).optional(),
});
export const CommandReplySchema = z.strictObject({
  id: z.string().max(100),
  state: AppStateSchema.optional(),
  error: z
    .strictObject({ code: z.string().max(100), message: z.string().max(2000) })
    .optional(),
});
export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('hello'),
    token: z.string().max(100),
    state: AppStateSchema,
  }),
  z.strictObject({ type: z.literal('state'), state: AppStateSchema }),
  z.strictObject({ type: z.literal('reply'), reply: CommandReplySchema }),
]);
