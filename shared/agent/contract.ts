import { z } from 'zod/v4';
import {
  PositionSchema,
  VoicingOptionsSchema,
  type Position,
  type VoicingResult,
} from '../music/voicings';

export const PROTOCOL_VERSION = 1;
const name = z.string().trim().min(1).max(100);
export const NoteListSchema = z
  .array(z.string().trim().min(1).max(12))
  .min(1)
  .max(12);
export const ViewSettingsSchema = z.strictObject({
  numberOfFrets: z.number().int().min(1).max(24),
  isLefty: z.boolean(),
  showTextNotes: z.boolean(),
  quickColors: z.enum(['scale', 'pentatonic', 'major/minor roots']),
  cagedModeEnabled: z.boolean(),
  cagedShape: z.enum(['C', 'A', 'G', 'E', 'D', 'ALL']),
});
export const SetViewSchema = z.strictObject({
  scale: name.optional(),
  settings: ViewSettingsSchema.partial().optional(),
  tuning: z.array(z.string().trim().min(1).max(6)).min(4).max(8).optional(),
});
export const ShowFretboardSchema = z
  .strictObject({
    scale: name.optional(),
    notes: NoteListSchema.optional(),
    chord: name.optional(),
    positions: z.array(PositionSchema).min(1).max(192).optional(),
  })
  .refine(
    input =>
      [input.notes, input.chord, input.positions].filter(Boolean).length <= 1,
    'Supply only one of notes, chord, or positions; omit all three to show the scale.',
  );
export const FindVoicingsSchema = z.strictObject({
  chord: name,
  options: VoicingOptionsSchema.optional(),
});
export const ShowVoicingsSchema = FindVoicingsSchema.extend({
  scale: name.optional(),
});
export const SelectVoicingSchema = z.strictObject({
  index: z.number().int().min(0).max(19).describe('Zero-based result index.'),
});
export const CommandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('set_view'), input: SetViewSchema }),
  z.strictObject({
    type: z.literal('show_fretboard'),
    input: ShowFretboardSchema,
  }),
  z.strictObject({
    type: z.literal('show_voicings'),
    input: ShowVoicingsSchema,
  }),
  z.strictObject({
    type: z.literal('select_voicing'),
    input: SelectVoicingSchema,
  }),
]);
export type Command = z.infer<typeof CommandSchema>;
export type Display = {
  kind: 'scale' | 'notes' | 'positions' | 'voicings';
  chord?: string;
  positions?: Position[];
  result?: VoicingResult;
  selectedIndex?: number;
};
export type AppState = {
  protocolVersion: 1;
  revision: number;
  viewReady: boolean;
  scale: string | null;
  scaleNotes: string[];
  tuning: string[];
  settings: z.infer<typeof ViewSettingsSchema>;
  highlightNotes: string[];
  display: Display;
};
export type SessionInfo = {
  id: string;
  platform: 'desktop' | 'chrome';
  title: string;
  revision: number;
  viewReady: boolean;
};
export type CommandRequest = {
  id: string;
  command: Command;
  expectedRevision?: number;
};
export type CommandReply = {
  id: string;
  state?: AppState;
  error?: { code: string; message: string };
};
export type ConnectionInfo = { url: string; token: string };
export interface ToolHost {
  listSessions(): SessionInfo[];
  getState(sessionId?: string): AppState;
  execute(
    command: Command,
    sessionId?: string,
    expectedRevision?: number,
  ): Promise<AppState>;
}
export interface AppController {
  read(): AppState;
  subscribe(listener: (state: AppState) => void): () => void;
  execute(command: Command, expectedRevision?: number): Promise<AppState>;
}
