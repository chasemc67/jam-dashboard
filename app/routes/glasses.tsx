// /glasses: a 600x600 dark view for Meta Ray-Ban Display glasses. One short
// fretboard, a key picker and a CAGED toggle, all reachable with the
// touchpad's arrow keys (spatial navigation) and Enter.
//
// Continuous drag is off by default. With body `touch-action: none` the glasses
// send pinches/taps as pointer events at a screen position (usually over the
// fretboard), which focused the board and never activated the selected
// button. `/glasses?drag=1` opts back in, with taps routed to the focused
// button.
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type {
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import glassesStyles from '~/styles/glasses.css?url';
import GlassesFretboard from '~/components/GlassesFretboard';
import {
  GLASSES_KEYS,
  GLASSES_SHAPES,
  WINDOW_FRETS,
  MAX_STARTING_FRET,
  clampStartingFret,
  cycle,
  findShapeWindow,
  type GlassesMode,
  type GlassesShape,
} from '~/utils/glassesFretboard';
import { routeTapsToFocusedControl } from '~/utils/glassesTaps';

const LEFTY_STORAGE_KEY = 'jam-dashboard-glasses-lefty';

export const meta: MetaFunction = () => [
  { title: 'Jam Dashboard for Glasses' },
];

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: glassesStyles },
];

export const loader = ({ request }: LoaderFunctionArgs) => ({
  drag: new URL(request.url).searchParams.get('drag') === '1',
});

const button =
  'glasses-focus flex h-16 items-center justify-center rounded-xl bg-neutral-800 px-3 text-3xl font-bold text-white active:bg-neutral-600 aria-disabled:opacity-40';

export default function Glasses() {
  const { drag } = useLoaderData<typeof loader>();
  const [keyIndex, setKeyIndex] = useState(0);
  const [mode, setMode] = useState<GlassesMode>('major');
  const [shape, setShape] = useState<GlassesShape>('off');
  const [startingFret, setStartingFret] = useState(0);
  const [isLefty, setIsLefty] = useState(false);
  const musicKey = GLASSES_KEYS[mode][keyIndex];

  useEffect(() => {
    try {
      setIsLefty(localStorage.getItem(LEFTY_STORAGE_KEY) === 'true');
    } catch {
      // Storage unavailable: stay right-handed.
    }
  }, []);

  useEffect(
    () => (drag ? routeTapsToFocusedControl(document) : undefined),
    [drag],
  );

  const toggleLefty = () => {
    const next = !isLefty;
    setIsLefty(next);
    try {
      localStorage.setItem(LEFTY_STORAGE_KEY, String(next));
    } catch {
      // Storage unavailable: keep it for this visit only.
    }
  };

  const jumpToShape = (key: string, m: GlassesMode, s: GlassesShape) => {
    const window = findShapeWindow(key, m, s);
    if (window !== null) setStartingFret(window);
  };
  const changeKey = (step: number) => {
    const next = (keyIndex + step + 12) % 12;
    setKeyIndex(next);
    jumpToShape(GLASSES_KEYS[mode][next], mode, shape);
  };
  const changeShape = () => {
    const next = cycle(GLASSES_SHAPES, shape, 1);
    setShape(next);
    jumpToShape(musicKey, mode, next);
  };
  const toggleMode = () => {
    const next = mode === 'major' ? 'minor' : 'major';
    setMode(next);
    jumpToShape(GLASSES_KEYS[next][keyIndex], next, shape);
  };
  // Screen direction: -1 shows what is to the left of the window.
  const slideScreen = (direction: -1 | 1) =>
    setStartingFret(f =>
      clampStartingFret(f + (isLefty ? -direction : direction)),
    );
  const atLeftEnd = isLefty
    ? startingFret === MAX_STARTING_FRET
    : startingFret === 0;
  const atRightEnd = isLefty
    ? startingFret === 0
    : startingFret === MAX_STARTING_FRET;

  return (
    <main
      className="mx-auto flex h-[600px] w-[600px] flex-col justify-between overflow-hidden bg-black p-4 text-white"
      aria-label="Jam Dashboard glasses fretboard"
    >
      {drag && (
        // Read by the glasses once at load to opt into continuous drag.
        <style>{'body{touch-action:none}'}</style>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={`${button} w-16`}
          aria-label="Previous key"
          data-testid="glasses-key-prev"
          onClick={() => changeKey(-1)}
        >
          <ChevronLeft size={44} strokeWidth={3} aria-hidden />
        </button>
        <button
          type="button"
          className={`${button} flex-1`}
          aria-label={`Key ${musicKey}, next key`}
          data-testid="glasses-key"
          onClick={() => changeKey(1)}
        >
          {musicKey}
        </button>
        <button
          type="button"
          className={`${button} w-16`}
          aria-label="Next key"
          data-testid="glasses-key-next"
          onClick={() => changeKey(1)}
        >
          <ChevronRight size={44} strokeWidth={3} aria-hidden />
        </button>
        <button
          type="button"
          className={`${button} w-28 text-2xl`}
          aria-label={`Mode ${mode}, switch`}
          data-testid="glasses-mode"
          onClick={toggleMode}
        >
          {mode === 'major' ? 'Major' : 'Minor'}
        </button>
        <button
          type="button"
          className={`${button} w-28 text-2xl ${isLefty ? '!bg-sky-700' : ''}`}
          aria-label="Left-handed"
          aria-pressed={isLefty}
          data-testid="glasses-lefty"
          onClick={toggleLefty}
        >
          {isLefty ? 'Lefty' : 'Righty'}
        </button>
      </div>

      <GlassesFretboard
        musicKey={musicKey}
        mode={mode}
        shape={shape}
        startingFret={startingFret}
        onStartingFretChange={setStartingFret}
        isLefty={isLefty}
        focusOnMount
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          className={`${button} w-16`}
          aria-label="Slide left"
          data-testid="glasses-slide-left"
          aria-disabled={atLeftEnd}
          onClick={() => slideScreen(-1)}
        >
          <ChevronLeft size={44} strokeWidth={3} aria-hidden />
        </button>
        <span
          className="flex-1 text-center text-2xl font-semibold text-neutral-200"
          data-testid="glasses-range"
          aria-live="polite"
        >
          Frets {startingFret + 1}–{startingFret + WINDOW_FRETS}
        </span>
        <button
          type="button"
          className={`${button} w-16`}
          aria-label="Slide right"
          data-testid="glasses-slide-right"
          aria-disabled={atRightEnd}
          onClick={() => slideScreen(1)}
        >
          <ChevronRight size={44} strokeWidth={3} aria-hidden />
        </button>
        <button
          type="button"
          className={`${button} w-48 whitespace-nowrap text-2xl`}
          aria-label={`CAGED ${shape}, next shape`}
          data-testid="glasses-shape"
          onClick={changeShape}
        >
          CAGED: {shape === 'off' ? 'Off' : shape === 'ALL' ? 'All' : shape}
        </button>
      </div>
    </main>
  );
}
