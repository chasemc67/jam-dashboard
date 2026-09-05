import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import DesktopAnalyzer from './DesktopAnalyzer';
import { ScaleKeyProvider, useScaleKey } from '~/contexts/ScaleKeyContext';
import type { AnalyzerState } from '~/types/analyzer';

function Selection() {
  const { keyScale, notes } = useScaleKey();
  return (
    <output data-testid="selection">
      {keyScale}: {notes.join(',')}
    </output>
  );
}
const complete: AnalyzerState = {
  revision: 1,
  status: 'complete',
  destination: '/tmp/music',
  tools: { ytDlp: true, ffmpeg: true },
  file: { path: '/tmp/music/song.mp3', name: 'song.mp3' },
  error: null,
  analysis: {
    bpm: 92.5,
    musicalKey: 'F♯ / G♭ minor',
    keyScale: 'F# minor',
    relativeMajorKey: 'A major',
    relativeMajorKeyScale: 'A major',
    tempoConfidence: 0.8,
    keyConfidence: 0.7,
  },
};
let receive: (state: AnalyzerState) => void;
const ok = async () => ({ ok: true });
beforeEach(() => {
  window.jamDesktop = {
    getAnalyzerState: async () => complete,
    onAnalyzerState: callback => {
      receive = callback;
      return () => {};
    },
    startYouTube: jest.fn(ok),
    chooseAudio: ok,
    analyzeDroppedFile: ok,
    chooseDestination: ok,
    cancelAnalysis: jest.fn(ok),
    revealAudio: ok,
  };
});
afterEach(() => {
  delete window.jamDesktop;
});
function mount() {
  return render(
    <ScaleKeyProvider>
      <DesktopAnalyzer />
      <Selection />
    </ScaleKeyProvider>,
  );
}

test('detected minor and relative major buttons update the shared key and notes', async () => {
  mount();
  fireEvent.click(
    await screen.findByRole('button', { name: 'Use F♯ / G♭ minor' }),
  );
  expect(screen.getByTestId('selection')).toHaveTextContent(
    'F# minor: F#,G#,A,B,C#,D,E',
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Use relative major: A major' }),
  );
  expect(screen.getByTestId('selection')).toHaveTextContent(
    'A major: A,B,C#,D,E,F#,G#',
  );
});
test('remounting retrieves the latest job without cancelling it', async () => {
  const unsubscribe = jest.fn();
  window.jamDesktop!.onAnalyzerState = callback => {
    receive = callback;
    return unsubscribe;
  };
  const view = mount();
  await screen.findByRole('button', { name: 'Use F♯ / G♭ minor' });
  view.unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  window.jamDesktop!.getAnalyzerState = async () => ({
    ...complete,
    revision: 2,
    status: 'analyzing',
    analysis: null,
  });
  mount();
  await screen.findByText('Listening for tempo and key…');
  act(() => receive({ ...complete, revision: 3 }));
  expect(
    screen.getByRole('button', { name: 'Use F♯ / G♭ minor' }),
  ).toBeInTheDocument();
  expect(window.jamDesktop?.cancelAnalysis).not.toHaveBeenCalled();
});
test('stale snapshots cannot overwrite a newer result and requests show launch errors', async () => {
  mount();
  await screen.findByRole('button', { name: 'Use F♯ / G♭ minor' });
  act(() =>
    receive({ ...complete, revision: 0, status: 'idle', analysis: null }),
  );
  expect(
    screen.getByRole('button', { name: 'Use F♯ / G♭ minor' }),
  ).toBeInTheDocument();
  window.jamDesktop!.startYouTube = jest.fn(async () => ({
    ok: false,
    error: 'Invalid YouTube URL.',
  }));
  fireEvent.change(screen.getByLabelText('YouTube URL'), {
    target: { value: 'not youtube' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Download MP3 & Analyze' }),
  );
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid YouTube URL.'),
  );
});
