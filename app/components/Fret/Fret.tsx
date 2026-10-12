// Fret.tsx
// This component renders a single fret on a guitar
// It renders a box with a line for each string (6 by default)
// and also takes a list of notes which should be highlighted/displayed on the fret.
// it calculates which notes would appear on each string, by its offset (fret number)
// and root notes each string is tuned to.

import React from 'react';
import { getNoteColorClass } from '~/utils/noteColors';
import { useHighlight } from '~/contexts/HighlightContext';
import { useSettings } from '~/contexts/SettingsContext';
import { useScaleKey } from '~/contexts/ScaleKeyContext';
import { orientCagedColors } from '~/utils/cagedColorUtils';
import {
  getFretNoteMarker,
  usesCagedColors,
  type FretNoteMarkerOptions,
} from '~/utils/fretNoteMarkers';
import '~/tailwind.css';
import type { Position } from '../../../shared/music/voicings';

export type { HighlightedNote } from '~/utils/fretNoteMarkers';

export type FretProps = {
  rootNotes: string[];
  fretNumber: number;
  showTextNotes?: boolean;
  positions?: Position[];
};

const getFretWidth = (
  fretNumber: number,
): { mobile: number; desktop: number } => {
  const mobileBase = 80;
  const desktopBase = 120;
  const factor = 0.94;
  return {
    mobile: mobileBase * Math.pow(factor, fretNumber),
    desktop: desktopBase * Math.pow(factor, fretNumber),
  };
};

const Fret: React.FC<FretProps> = ({
  rootNotes,
  fretNumber,
  showTextNotes,
  positions,
}) => {
  const widths = getFretWidth(fretNumber);
  const { getHighlightedNotes } = useHighlight();
  const { settings } = useSettings();
  const { notes, pentatonicNotes } = useScaleKey();
  const markerOptions: FretNoteMarkerOptions = {
    notes,
    pentatonicNotes,
    highlightedNotes: getHighlightedNotes(),
    cagedModeEnabled: settings.cagedModeEnabled,
    cagedShape: settings.cagedShape,
    showTextNotes,
    positions,
  };

  const renderCagedStrings = () => {
    return rootNotes.map((rootNote, stringIndex) => {
      const marker = getFretNoteMarker(
        markerOptions,
        rootNote,
        stringIndex,
        fretNumber,
      );

      if (marker) {
        const [leftColor, rightColor] = orientCagedColors(
          marker.colors,
          settings.isLefty,
        );
        const isSplit = rightColor !== undefined;

        return (
          <div
            key={stringIndex}
            className="h-[2px] bg-[#808080] relative z-[2]"
          >
            <div
              data-testid="caged-note"
              className={`rounded-md w-5 h-5 absolute -top-[9px] left-[calc(50%-10px)] flex items-center justify-center overflow-hidden text-muted z-[3] ${isSplit ? '' : getNoteColorClass(leftColor, 'background')}`}
            >
              {isSplit && (
                <>
                  <div
                    data-testid="caged-note-left"
                    className={`absolute inset-y-0 left-0 w-1/2 ${getNoteColorClass(leftColor, 'background')}`}
                  />
                  <div
                    data-testid="caged-note-right"
                    className={`absolute inset-y-0 right-0 w-1/2 ${getNoteColorClass(rightColor, 'background')}`}
                  />
                </>
              )}
              <span className="relative">{marker.label}</span>
            </div>
          </div>
        );
      }

      return (
        <div
          key={stringIndex}
          className="h-[2px] bg-[#808080] relative z-[2]"
        />
      );
    });
  };

  const renderNormalStrings = () => {
    return rootNotes.map((rootNote, index) => {
      const marker = getFretNoteMarker(
        markerOptions,
        rootNote,
        index,
        fretNumber,
      );

      return (
        <div key={index} className="h-[2px] bg-[#808080] relative z-[2]">
          {marker && (
            <div
              data-testid="fret-note"
              aria-label={`String ${index + 1}, fret ${fretNumber}, ${marker.note}`}
              className={`rounded-md w-6 h-6 absolute -top-[11px] left-[calc(50%-10px)] flex items-center justify-center text-muted z-[3] ${getNoteColorClass(marker.colors[0], 'background')}`}
            >
              {marker.label}
            </div>
          )}
        </div>
      );
    });
  };

  const fretMarkers = [3, 5, 7, 9, 12, 15, 17, 19, 24];
  const tallMarkerFrets = [12, 24];

  const shouldRenderCaged = usesCagedColors(markerOptions);

  return (
    <div
      style={{
        width: `${widths.mobile}px`,
        flexShrink: 0,
        ['--fret-desktop-width' as string]: `${widths.desktop}px`,
      }}
      className="flex flex-col justify-between bg-accent border border-card p-2.5 relative h-[300px] md:!w-[var(--fret-desktop-width)]"
    >
      {shouldRenderCaged ? renderCagedStrings() : renderNormalStrings()}
      <span className="absolute -bottom-6 left-0 w-full text-center text-xs text-muted-foreground">
        {fretNumber}
      </span>
      {fretMarkers.includes(fretNumber) && (
        <div
          className={`bg-background w-3/4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1] ${tallMarkerFrets.includes(fretNumber) ? 'h-1/2' : 'h-1/4'}`}
        />
      )}
    </div>
  );
};

export default Fret;
