// /glasses: a 600x600 dark view for Meta Ray-Ban Display glasses. One short
// fretboard, a key picker and a CAGED toggle, all reachable with the
// touchpad's arrow keys (spatial navigation) and Enter.
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { LinksFunction, MetaFunction } from '@remix-run/node';
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

export const meta: MetaFunction = () => [
  { title: 'Jam Dashboard for Glasses' },
];

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: glassesStyles },
];

const button =
  'glasses-focus flex h-16 items-center justify-center rounded-xl bg-neutral-800 px-4 text-3xl font-bold text-white active:bg-neutral-600 aria-disabled:opacity-40';

export default function Glasses() {
  const [keyIndex, setKeyIndex] = useState(0);
  const [mode, setMode] = useState<GlassesMode>('major');
  const [shape, setShape] = useState<GlassesShape>('off');
  const [startingFret, setStartingFret] = useState(0);
  const musicKey = GLASSES_KEYS[mode][keyIndex];

  const changeKey = (step: number) => {
    const next = (keyIndex + step + 12) % 12;
    setKeyIndex(next);
    const window = findShapeWindow(GLASSES_KEYS[mode][next], mode, shape);
    if (window !== null) setStartingFret(window);
  };
  const changeShape = () => {
    const next = cycle(GLASSES_SHAPES, shape, 1);
    setShape(next);
    const window = findShapeWindow(musicKey, mode, next);
    if (window !== null) setStartingFret(window);
  };
  const toggleMode = () => {
    const next = mode === 'major' ? 'minor' : 'major';
    setMode(next);
    const window = findShapeWindow(GLASSES_KEYS[next][keyIndex], next, shape);
    if (window !== null) setStartingFret(window);
  };
  const slide = (delta: number) =>
    setStartingFret(f => clampStartingFret(f + delta));

  const shapeLabel =
    shape === 'off' ? 'Off' : shape === 'ALL' ? 'All' : `${shape} shape`;

  return (
    <main
      className="mx-auto flex h-[600px] w-[600px] flex-col justify-between overflow-hidden bg-black p-4 text-white"
      aria-label="Jam Dashboard glasses fretboard"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className={`${button} w-16`}
          aria-label="Previous key"
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
          onClick={() => changeKey(1)}
        >
          <ChevronRight size={44} strokeWidth={3} aria-hidden />
        </button>
        <button
          type="button"
          className={`${button} w-40`}
          aria-label={`Mode ${mode}, switch`}
          onClick={toggleMode}
        >
          {mode === 'major' ? 'Major' : 'Minor'}
        </button>
      </div>

      <GlassesFretboard
        musicKey={musicKey}
        mode={mode}
        shape={shape}
        startingFret={startingFret}
        onStartingFretChange={setStartingFret}
        focusOnMount
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          className={`${button} w-16`}
          aria-label="Slide toward the nut"
          aria-disabled={startingFret === 0}
          onClick={() => slide(-1)}
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
          aria-label="Slide toward the bridge"
          aria-disabled={startingFret === MAX_STARTING_FRET}
          onClick={() => slide(1)}
        >
          <ChevronRight size={44} strokeWidth={3} aria-hidden />
        </button>
        <button
          type="button"
          className={`${button} w-48 whitespace-nowrap text-2xl`}
          aria-label={`CAGED ${shapeLabel}, next shape`}
          data-testid="glasses-shape"
          onClick={changeShape}
        >
          CAGED: {shape === 'off' ? 'Off' : shape === 'ALL' ? 'All' : shape}
        </button>
      </div>
    </main>
  );
}
