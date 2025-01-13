// Fret.tsx
// This component renders a single fret on a guitar
// It renders a box with a line for each string (6 by default)
// and also takes a list of notes which should be highlighted/displayed on the fret.
// it calculates which notes would appear on each string, by its offset (fret number)
// and root notes each string is tuned to.

import React from 'react';
import { getNoteAtFret, areNotesEquivalent } from '~/utils/musicTheoryUtils';
import { getNoteColorClass } from '~/utils/noteColors';
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
};

const getFretWidth = (fretNumber: number): number => {
  const baseWidth = 120;
  const factor = 0.94;
  return baseWidth * Math.pow(factor, fretNumber);
};

const Fret: React.FC<FretProps> = ({
  rootNotes,
  fretNumber,
  highlightedNotes,
  showTextNotes,
}) => {
  const renderStrings = () => {
    return rootNotes.map((rootNote, index) => {
      const currentNote = getNoteAtFret(rootNote, fretNumber);
      const highlightedNote = highlightedNotes.find(hn =>
        areNotesEquivalent(hn.note, currentNote),
      );

      return (
        <div key={index} className="h-[2px] bg-[#808080] relative z-[2]">
          {highlightedNote && (
            <div
              className={`rounded-full w-5 h-5 absolute -top-[9px] left-[calc(50%-10px)] flex items-center justify-center text-white z-[3] ${getNoteColorClass(highlightedNote.color, 'background')}`}
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
      style={{ width: `${getFretWidth(fretNumber)}px` }}
      className="flex flex-col justify-between bg-[#f0e9e2] border border-[#c0b7a8] p-2.5 relative h-[300px]"
    >
      {renderStrings()}
      {fretMarkers.includes(fretNumber) && (
        <div
          className={`bg-[#aaa] w-3/4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1] ${tallMarkerFrets.includes(fretNumber) ? 'h-1/2' : 'h-1/4'}`}
        />
      )}
    </div>
  );
};

export default Fret;
