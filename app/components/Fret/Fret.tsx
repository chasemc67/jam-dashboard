// Fret.tsx
// This component renders a single fret on a guitar
// It renders a box with a line for each string (6 by default)
// and also takes a list of notes which should be highlighted/displayed on the fret.
// it calculates which notes would appear on each string, by its offset (fret number)
// and root notes each string is tuned to.

import React from 'react';
import { getNoteAtFret, areNotesEquivalent } from '~/utils/musicTheoryUtils';
import { getNoteColorClass } from '~/utils/noteColors';
import { getNotesForStringInShape } from '~/utils/cagedShapeUtils';
import { useHighlight, INTERVALS } from '~/contexts/HighlightContext';
import { useSettings } from '~/contexts/SettingsContext';
import { useScaleKey } from '~/contexts/ScaleKeyContext';
import { getCagedNoteColor } from '~/utils/cagedColorUtils';
import '~/tailwind.css';

export type HighlightedNote = {
  note: string;
  color: string;
};

export type FretProps = {
  rootNotes: string[];
  fretNumber: number;
  showTextNotes?: boolean;
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
}) => {
  const widths = getFretWidth(fretNumber);
  const { getHighlightedNotes } = useHighlight();
  const { settings } = useSettings();
  const { notes, pentatonicNotes } = useScaleKey();

  const renderCagedStrings = () => {
    return rootNotes.map((rootNote, stringIndex) => {
      const stringNumber = stringIndex + 1; // Convert to 1-based index
      const currentNote = getNoteAtFret(rootNote, fretNumber);

      const noteColor = getCagedNoteColor(
        currentNote,
        stringNumber,
        settings.cagedShape,
        notes,
        pentatonicNotes,
        getNotesForStringInShape,
      );

      if (noteColor) {
        return (
          <div
            key={stringIndex}
            className="h-[2px] bg-[#808080] relative z-[2]"
          >
            <div
              className={`rounded-md w-5 h-5 absolute -top-[9px] left-[calc(50%-10px)] flex items-center justify-center text-muted z-[3] ${getNoteColorClass(noteColor, 'background')}`}
            >
              {showTextNotes
                ? currentNote
                : INTERVALS[notes.indexOf(currentNote)]}
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
      const currentNote = getNoteAtFret(rootNote, fretNumber);
      const highlightedNote = getHighlightedNotes().find(hn =>
        areNotesEquivalent(hn.note, currentNote),
      );

      return (
        <div key={index} className="h-[2px] bg-[#808080] relative z-[2]">
          {highlightedNote && (
            <div
              className={`rounded-md w-6 h-6 absolute -top-[11px] left-[calc(50%-10px)] flex items-center justify-center text-muted z-[3] ${getNoteColorClass(highlightedNote.color, 'background')}`}
            >
              {showTextNotes
                ? highlightedNote.note
                : INTERVALS[notes.indexOf(highlightedNote.note)]}
            </div>
          )}
        </div>
      );
    });
  };

  const fretMarkers = [3, 5, 7, 9, 12, 15, 17, 19, 24];
  const tallMarkerFrets = [12, 24];

  const shouldRenderCaged =
    settings.cagedModeEnabled && pentatonicNotes.length !== 0;

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
      {fretMarkers.includes(fretNumber) && (
        <div
          className={`bg-background w-3/4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1] ${tallMarkerFrets.includes(fretNumber) ? 'h-1/2' : 'h-1/4'}`}
        />
      )}
    </div>
  );
};

export default Fret;
