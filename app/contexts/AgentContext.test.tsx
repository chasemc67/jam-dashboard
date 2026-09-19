import { act, fireEvent, render, screen } from '@testing-library/react';
import { ContextProviders } from '~/components/ContextProviders';
import { useAgent } from './AgentContext';
import { useScaleKey } from './ScaleKeyContext';
import { useHighlight } from './HighlightContext';
import FretboardControls from '~/components/FretboardControls';
import type { AppController } from '../../shared/agent/contract';
jest.mock('~/tailwind.css', () => ({}));

let controller: AppController;
function Harness() {
  controller = useAgent().controller;
  const { setKeyScale } = useScaleKey();
  const { setChordHighlight } = useHighlight();
  return (
    <>
      <button onClick={() => setKeyScale('G major')}>Manual G major</button>
      <button onClick={() => setKeyScale('C major')}>Manual C major</button>
      <button onClick={() => setChordHighlight(['C', 'E', 'G'])}>
        Manual C chord
      </button>
      <FretboardControls />
    </>
  );
}
beforeEach(() => localStorage.clear());
test('acknowledges the rendered exact voicing, reflects manual edits and clears stale selection', async () => {
  render(
    <ContextProviders>
      <Harness />
    </ContextProviders>,
  );
  await act(async () => {
    const state = await controller.execute({
      type: 'show_voicings',
      input: { chord: 'C/E' },
    });
    expect(state.display.kind).toBe('voicings');
    expect(screen.getAllByTestId('fret-note')).toHaveLength(
      state.display.positions!.filter(p => p.fret > 0).length,
    );
  });
  const before = controller.read().revision;
  fireEvent.click(screen.getByText('Next'));
  expect(controller.read().display.selectedIndex).toBe(1);
  expect(controller.read().revision).toBeGreaterThan(before);
  fireEvent.click(screen.getByText('Manual G major'));
  expect(controller.read()).toMatchObject({
    scale: 'G major',
    display: { kind: 'scale' },
    highlightNotes: [],
  });
});

test('manual selection of the same chord exits a voicing, and changing back to a scale does not resurrect it', async () => {
  render(
    <ContextProviders>
      <Harness />
    </ContextProviders>,
  );
  await act(async () => {
    await controller.execute({ type: 'show_voicings', input: { chord: 'C' } });
  });
  fireEvent.click(screen.getByText('Manual C chord'));
  expect(controller.read().display.kind).toBe('notes');
  expect(controller.read().display.positions).toBeUndefined();
  await act(async () => {
    await controller.execute({ type: 'show_voicings', input: { chord: 'C' } });
  });
  fireEvent.click(screen.getByText('Manual G major'));
  fireEvent.click(screen.getByText('Manual C major'));
  expect(controller.read()).toMatchObject({
    display: { kind: 'scale' },
    highlightNotes: [],
  });
});
test('changes scale and chord atomically, rejects invalid input without a partial render', async () => {
  render(
    <ContextProviders>
      <Harness />
    </ContextProviders>,
  );
  await act(async () => {
    await controller.execute({
      type: 'show_fretboard',
      input: { scale: 'Db major', chord: 'Db' },
    });
  });
  expect(controller.read()).toMatchObject({
    scale: 'Db major',
    highlightNotes: ['Db', 'F', 'Ab'],
    display: { chord: 'Db' },
  });
  const state = controller.read();
  await expect(
    controller.execute({ type: 'show_fretboard', input: { chord: 'D' } }),
  ).rejects.toThrow('outside');
  expect(controller.read()).toBe(state);
});
