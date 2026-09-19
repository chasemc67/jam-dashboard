import { prepareCommand } from './commands';
import { initialState } from './fixtures';
import { agentTools } from './tools';
import type { ToolHost } from './contract';

test('a failed command leaves the previous view intact', () => {
  const state = initialState();
  const before = JSON.stringify(state);
  expect(() =>
    prepareCommand(state, { type: 'show_fretboard', input: { chord: 'D' } }),
  ).toThrow('outside');
  expect(JSON.stringify(state)).toBe(before);
  expect(() =>
    prepareCommand(state, { type: 'show_fretboard', input: {} }, 0),
  ).toThrow('view changed');
});
test('explicit scale changes allow matching notes in one atomic command', () => {
  const state = prepareCommand(initialState(), {
    type: 'show_fretboard',
    input: { scale: 'Db major', notes: ['C#', 'F', 'G#'] },
  });
  expect(state.highlightNotes).toEqual(['Db', 'F', 'Ab']);
  expect(state.scale).toBe('Db major');
  expect(state.display.kind).toBe('notes');
});
test('exact positions must fit the scale and displayed fretboard', () => {
  expect(() =>
    prepareCommand(initialState(), {
      type: 'show_fretboard',
      input: { positions: [{ string: 1, fret: 2 }] },
    }),
  ).toThrow('outside');
  expect(() =>
    prepareCommand(initialState(), {
      type: 'show_fretboard',
      input: { positions: [{ string: 7, fret: 1 }] },
    }),
  ).toThrow('outside the displayed');
  expect(
    prepareCommand(initialState(), {
      type: 'show_fretboard',
      input: { positions: [{ string: 1, fret: 0 }] },
    }).highlightNotes,
  ).toEqual(['E']);
});
test('voicing selection stays in the result set and respects tuning', () => {
  const shown = prepareCommand(initialState(), {
    type: 'show_voicings',
    input: { chord: 'C' },
  });
  const selected = prepareCommand(shown, {
    type: 'select_voicing',
    input: { index: 1 },
  });
  expect(selected.display.positions).toEqual(
    shown.display.result!.voicings[1].positions,
  );
  const dropD = { ...initialState(), tuning: ['E', 'B', 'G', 'D', 'A', 'D'] };
  expect(() =>
    prepareCommand(dropD, { type: 'show_voicings', input: { chord: 'C' } }),
  ).toThrow('E standard');
  expect(() =>
    prepareCommand(initialState(), {
      type: 'select_voicing',
      input: { index: 0 },
    }),
  ).toThrow('Run show_voicings');
});
test('CAGED validation, clearing and view readiness are explicit', () => {
  expect(() =>
    prepareCommand(
      { ...initialState(), viewReady: false },
      { type: 'set_view', input: {} },
    ),
  ).toThrow('Open the dashboard');
  expect(() =>
    prepareCommand(
      { ...initialState(), scale: null },
      { type: 'show_fretboard', input: {} },
    ),
  ).toThrow('Select a scale');
  expect(() =>
    prepareCommand(initialState(), {
      type: 'set_view',
      input: { scale: 'C dorian', settings: { cagedModeEnabled: true } },
    }),
  ).toThrow('pentatonic mapping');
  const caged = prepareCommand(initialState(), {
    type: 'set_view',
    input: { settings: { cagedModeEnabled: true, cagedShape: 'G' } },
  });
  expect(caged.settings.cagedShape).toBe('G');
  expect(
    prepareCommand(caged, { type: 'show_fretboard', input: { chord: 'C' } })
      .settings.cagedModeEnabled,
  ).toBe(false);
});
test('all transports share validated tool definitions and structured errors', async () => {
  const host: ToolHost = {
    listSessions: () => [],
    getState: initialState,
    execute: async command => prepareCommand(initialState(), command),
  };
  const show = agentTools.find(t => t.name === 'show_fretboard')!;
  expect(await show.execute({ notes: ['C'], chord: 'C' }, host)).toMatchObject({
    ok: false,
    error: { code: 'INVALID_INPUT' },
  });
  expect(await show.execute({ chord: 'D' }, host)).toMatchObject({
    ok: false,
    error: { code: 'NOTES_OUTSIDE_SCALE' },
  });
  expect(await show.execute({ notes: ['C'] }, host)).toMatchObject({
    ok: true,
    data: { highlightNotes: ['C'] },
  });
});
