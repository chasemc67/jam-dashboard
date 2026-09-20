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
  jobId: 'first-job',
  query: 'Blue Skies Ella Fitzgerald',
  status: 'complete',
  destination: '/tmp/music',
  tools: { ytDlp: true, ffmpeg: true },
  file: { path: '/tmp/music/song.mp3', name: 'song.mp3' },
  source: null,
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
    onAnalyzerOpen: () => () => {},
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
  fireEvent.change(screen.getByLabelText('Song name or YouTube URL'), {
    target: { value: 'https://example.com/not-youtube' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Download MP3 & Analyze' }),
  );
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid YouTube URL.'),
  );
});

test('song search is cancellable, prevents duplicate jobs, and displays the resolved video', async () => {
  mount();
  await screen.findByRole('button', { name: 'Use F♯ / G♭ minor' });
  const input = screen.getByLabelText('Song name or YouTube URL');
  fireEvent.change(input, { target: { value: 'Blue Skies Ella Fitzgerald' } });
  fireEvent.click(
    screen.getByRole('button', { name: 'Download MP3 & Analyze' }),
  );
  await waitFor(() =>
    expect(window.jamDesktop?.startYouTube).toHaveBeenCalledWith(
      'Blue Skies Ella Fitzgerald',
    ),
  );
  act(() =>
    receive({
      ...complete,
      revision: 2,
      status: 'searching',
      analysis: null,
      file: null,
    }),
  );
  expect(
    screen.getByText('Searching YouTube for your song…'),
  ).toBeInTheDocument();
  expect(input).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Download MP3 & Analyze' }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() =>
    expect(window.jamDesktop?.cancelAnalysis).toHaveBeenCalledTimes(1),
  );
  act(() =>
    receive({
      ...complete,
      revision: 3,
      source: {
        title: 'Blue Skies',
        url: 'https://www.youtube.com/watch?v=BaW_jenozKc',
        channel: 'Artist channel',
        duration: 185,
      },
    }),
  );
  expect(
    screen.getByRole('link', { name: 'Blue Skies (opens in browser)' }),
  ).toHaveAttribute('href', 'https://www.youtube.com/watch?v=BaW_jenozKc');
  expect(screen.getByText('Artist channel · 3:05')).toBeInTheDocument();
  expect(input).not.toBeDisabled();
});

test('an agent-started job updates the query, while progress and stale snapshots preserve a drafted next query', async () => {
  mount();
  const input = screen.getByLabelText('Song name or YouTube URL');
  await waitFor(() => expect(input).toHaveValue('Blue Skies Ella Fitzgerald'));

  fireEvent.change(input, { target: { value: 'My next song' } });
  act(() => receive({ ...complete, revision: 2 }));
  expect(input).toHaveValue('My next song');

  const nextJob: AnalyzerState = {
    ...complete,
    revision: 3,
    jobId: 'agent-started-job',
    query: 'Another song and artist',
    status: 'searching',
    source: null,
    file: null,
    analysis: null,
  };
  act(() => receive(nextJob));
  expect(input).toHaveValue('Another song and artist');
  expect(input).toBeDisabled();
  expect(screen.getByTestId('selection')).toHaveTextContent('C major:');

  act(() => receive({ ...complete, revision: 2 }));
  expect(input).toHaveValue('Another song and artist');
  act(() => receive({ ...nextJob, revision: 4, status: 'cancelled' }));
  fireEvent.change(input, { target: { value: 'A different recording' } });
  act(() => receive({ ...nextJob, revision: 5, status: 'cancelled' }));
  expect(input).toHaveValue('A different recording');
});
