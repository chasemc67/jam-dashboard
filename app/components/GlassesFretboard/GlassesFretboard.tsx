// A short, large-print fretboard for Meta Ray-Ban Display glasses (600x600).
// Arrow Left/Right while it is focused slides the window one fret; Up/Down are
// left to the browser's spatial navigation so focus can leave.
import React, { useEffect, useRef } from 'react';
import { getNoteColorClass } from '~/utils/noteColors';
import { orientCagedColors } from '~/utils/cagedColorUtils';
import {
  GLASSES_TUNING,
  WINDOW_FRETS,
  MAX_STARTING_FRET,
  clampStartingFret,
  getMarker,
  type GlassesMode,
  type GlassesShape,
} from '~/utils/glassesFretboard';

const FRET_WIDTH = 100;
const STRING_GAP = 50;
const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_INLAYS = [12, 24];

export type GlassesFretboardProps = {
  musicKey: string;
  mode: GlassesMode;
  shape: GlassesShape;
  startingFret: number;
  onStartingFretChange: (fret: number) => void;
  /** Focus the fretboard once on mount so Left/Right slide right away. */
  focusOnMount?: boolean;
  /** Mirror horizontally: nut on the right, higher frets to the left. */
  isLefty?: boolean;
};

const GlassesFretboard: React.FC<GlassesFretboardProps> = ({
  musicKey,
  mode,
  shape,
  startingFret,
  onStartingFretChange,
  focusOnMount,
  isLefty = false,
}) => {
  const board = useRef<HTMLDivElement>(null);
  // Only on first mount: later renders must never pull focus off a button.
  const focusOnMountRef = useRef(focusOnMount);
  useEffect(() => {
    if (focusOnMountRef.current) board.current?.focus();
  }, []);
  const drag = useRef<{ x: number; start: number } | null>(null);
  const frets = Array.from(
    { length: WINDOW_FRETS },
    (_, i) => startingFret + i + 1,
  );
  // Screen column of the i-th fret in the window (left to right).
  const column = (i: number) => (isLefty ? WINDOW_FRETS - 1 - i : i);
  // +1 fret when the content moves the way higher frets lie on screen.
  const towardBridge = isLefty ? -1 : 1;

  const slide = (delta: number) =>
    onStartingFretChange(clampStartingFret(startingFret + delta));

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      // Right shows what is to the right of the window.
      slide((event.key === 'ArrowRight' ? 1 : -1) * towardBridge);
    }
  };

  // Content follows the finger: dragging toward the nut brings higher frets in.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { x: event.clientX, start: startingFret };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag.current) return;
    const moved = Math.round((drag.current.x - event.clientX) / FRET_WIDTH);
    const next = clampStartingFret(drag.current.start + moved * towardBridge);
    if (next !== startingFret) onStartingFretChange(next);
  };
  const endDrag = () => {
    drag.current = null;
  };

  const height = STRING_GAP * (GLASSES_TUNING.length - 1);
  const nut = startingFret === 0;
  const nutBorder = isLefty
    ? nut
      ? 'border-r-[8px] border-r-neutral-200'
      : 'border-r-2 border-r-neutral-500'
    : nut
      ? 'border-l-[8px] border-l-neutral-200'
      : 'border-l-2 border-l-neutral-500';

  return (
    <div
      // A custom slider: native controls can't express a pannable fretboard.
      role="slider"
      tabIndex={0}
      aria-label="Fretboard, left and right slide one fret"
      aria-valuemin={1}
      aria-valuemax={MAX_STARTING_FRET + 1}
      aria-valuenow={startingFret + 1}
      aria-valuetext={`Frets ${startingFret + 1} to ${startingFret + WINDOW_FRETS}`}
      data-testid="glasses-fretboard"
      data-lefty={isLefty ? 'true' : 'false'}
      ref={board}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="glasses-focus relative mx-auto select-none rounded-xl px-2 pt-7 pb-10"
      style={{ touchAction: 'none' }}
    >
      <div className={`flex ${isLefty ? 'flex-row-reverse' : ''}`}>
        {/* String names, high E on top */}
        <div className="relative w-10" style={{ height }}>
          {GLASSES_TUNING.map((note, s) => (
            <span
              key={s}
              className={`absolute -translate-y-1/2 text-2xl font-bold text-neutral-400 ${isLefty ? 'left-3' : 'right-3'}`}
              style={{ top: s * STRING_GAP }}
            >
              {note}
            </span>
          ))}
        </div>
        <div
          className={`relative ${nutBorder}`}
          style={{ height, width: FRET_WIDTH * WINDOW_FRETS }}
        >
          {/* Frets */}
          {frets.map((fret, i) => (
            <div
              key={fret}
              className={`absolute border-neutral-500 ${isLefty ? 'border-l-2' : 'border-r-2'}`}
              style={{
                left: column(i) * FRET_WIDTH,
                width: FRET_WIDTH,
                top: -14,
                bottom: -14,
              }}
            >
              {INLAYS.includes(fret) && (
                <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-700" />
              )}
              {DOUBLE_INLAYS.includes(fret) && (
                <>
                  <div className="absolute left-1/2 top-[30%] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-700" />
                  <div className="absolute left-1/2 top-[70%] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-700" />
                </>
              )}
              <span className="absolute -bottom-9 w-full text-center text-2xl font-semibold text-neutral-300">
                {fret}
              </span>
            </div>
          ))}
          {/* Strings */}
          {GLASSES_TUNING.map((_, s) => (
            <div
              key={s}
              className="absolute left-0 right-0 bg-neutral-400"
              style={{ top: s * STRING_GAP - 1, height: 1 + s * 0.5 }}
            />
          ))}
          {/* Notes */}
          {GLASSES_TUNING.map((_, s) =>
            frets.map((fret, i) => {
              const marker = getMarker(musicKey, mode, shape, s, fret);
              if (!marker) return null;
              const [first, second] = orientCagedColors(marker.colors, isLefty);
              return (
                <div
                  key={`${s}-${fret}`}
                  data-testid={marker.isRoot ? 'glasses-root' : 'glasses-note'}
                  aria-label={`String ${s + 1}, fret ${fret}, ${marker.note}${marker.isRoot ? ', root' : ''}`}
                  className={`absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full text-lg font-bold text-white ${second ? '' : getNoteColorClass(first, 'background')} ${marker.isRoot ? 'ring-4 ring-white' : ''}`}
                  style={{
                    left: column(i) * FRET_WIDTH + FRET_WIDTH / 2,
                    top: s * STRING_GAP,
                  }}
                >
                  {second && (
                    <>
                      <span
                        className={`absolute inset-y-0 left-0 w-1/2 ${getNoteColorClass(first, 'background')}`}
                      />
                      <span
                        className={`absolute inset-y-0 right-0 w-1/2 ${getNoteColorClass(second, 'background')}`}
                      />
                    </>
                  )}
                  <span className="relative drop-shadow">{marker.note}</span>
                </div>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
};

export default GlassesFretboard;
