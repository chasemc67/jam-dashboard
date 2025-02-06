// Fret.tsx
// This component renders a single fret on a guitar
// It renders a box with a line for each string (6 by default)
// and also takes a list of notes which should be highlighted/displayed on the fret.
// it calculates which notes would appear on each string, by its offset (fret number)
// and root notes each string is tuned to.

import React from 'react';
import { getNoteAtFret, areNotesEquivalent } from '~/utils/musicTheoryUtils';
import { getNoteColorClass } from '~/utils/noteColors';
import {
  getNotesForStringInShape,
  type CAGEDShape,
} from '~/utils/cagedShapeUtils';
import { useHighlightedNotes } from '~/contexts/HighlightedNotesContext';
import '~/tailwind.css';

export type HighlightedNote = {
  note: string;
  color: string;
};

export type FretProps = {
  rootNotes: string[];
  fretNumber: number;
  highlightedNotes: HighlightedNote[];
  showTextNotes?: boolean;
  isCaged?: boolean;
  cagedShape?: CAGEDShape;
};

// CAGED shape colors
const CAGED_COLORS: Record<CAGEDShape, string> = {
  C: 'red',
  A: 'blue',
  G: 'green',
  E: 'yellow',
  D: 'orange',
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
  highlightedNotes,
  showTextNotes,
  isCaged = true,
  cagedShape = 'C',
}) => {
  const widths = getFretWidth(fretNumber);
  const { get_notes_in_scale, get_pentatonic_notes_in_scale } =
    useHighlightedNotes();

  const renderCagedStrings = () => {
    const scaleNotes = get_notes_in_scale();
    const pentatonicNotes = get_pentatonic_notes_in_scale();

    return rootNotes.map((rootNote, stringIndex) => {
      const stringNumber = stringIndex + 1; // Convert to 1-based index
      const currentNote = getNoteAtFret(rootNote, fretNumber);
      const [firstPentatonicIndex, secondPentatonicIndex] =
        getNotesForStringInShape(stringNumber, cagedShape);

      // Get the actual notes from the pentatonic scale that should be highlighted for this string
      const shapePentatonicNotes = [
        pentatonicNotes[firstPentatonicIndex],
        pentatonicNotes[secondPentatonicIndex],
      ];

      // Check if the current note is in the scale
      const isInScale = scaleNotes.some(note =>
        areNotesEquivalent(note, currentNote),
      );

      if (isInScale) {
        // Check if the note is part of the CAGED shape (matches one of the pentatonic positions)
        const isInShape = shapePentatonicNotes.some(note =>
          areNotesEquivalent(note, currentNote),
        );

        return (
          <div
            key={stringIndex}
            className="h-[2px] bg-[#808080] relative z-[2]"
          >
            <div
              className={`rounded-md w-5 h-5 absolute -top-[9px] left-[calc(50%-10px)] flex items-center justify-center text-muted z-[3] ${getNoteColorClass(isInShape ? CAGED_COLORS[cagedShape] : 'grey', 'background')}`}
            >
              {showTextNotes && currentNote}
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
      const highlightedNote = highlightedNotes.find(hn =>
        areNotesEquivalent(hn.note, currentNote),
      );

      return (
        <div key={index} className="h-[2px] bg-[#808080] relative z-[2]">
          {highlightedNote && (
            <div
              className={`rounded-md w-5 h-5 absolute -top-[9px] left-[calc(50%-10px)] flex items-center justify-center text-muted z-[3] ${getNoteColorClass(highlightedNote.color, 'background')}`}
            >
              {showTextNotes && highlightedNote.note}
            </div>
          )}
        </div>
      );
    });
  };

  const fretMarkers = [3, 5, 7, 9, 12, 15, 17, 19, 24];
  const tallMarkerFrets = [12, 24];

  return (
    <div
      style={{
        width: `${widths.mobile}px`,
        flexShrink: 0,
        ['--fret-desktop-width' as string]: `${widths.desktop}px`,
      }}
      className="flex flex-col justify-between bg-accent border border-card p-2.5 relative h-[300px] md:!w-[var(--fret-desktop-width)]"
    >
      {isCaged ? renderCagedStrings() : renderNormalStrings()}
      {fretMarkers.includes(fretNumber) && (
        <div
          className={`bg-background w-3/4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1] ${tallMarkerFrets.includes(fretNumber) ? 'h-1/2' : 'h-1/4'}`}
        />
      )}
    </div>
  );
};

export default Fret;
