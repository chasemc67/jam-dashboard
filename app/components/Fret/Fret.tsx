// Fret.tsx
// This component renders a single fret on a guitar
// It renders a box with a line for each string (6 by default)
// and also takes a list of notes which should be highlighted/displayed on the fret.
// it calculates which notes would appear on each string, by its offset (fret number)
// and root notes each string is tuned to.

import React from 'react';
import styled from 'styled-components';
import {
  getNoteAtFret,
  areNotesEquivalent,
} from '../../utils/musicTheoryUtils';
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

// const getFretWidth = (fretNumber: number): string => {
//   const baseWidth = 120;
//   const factor = 0.94;
//   return `${baseWidth * Math.pow(factor, fretNumber)}px`;
// };

const FretMarker = styled.div`
  background-color: #aaa;
  width: 75%;
  height: 25%;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
`;

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
              style={
                { '--note-color': highlightedNote.color } as React.CSSProperties
              }
              className="rounded-full w-5 h-5 absolute -top-[9px] left-[calc(50%-10px)] flex items-center justify-center text-white z-[3] bg-[var(--note-color)]"
            >
              {showTextNotes && highlightedNote.note}
            </div>
          )}
        </div>
      );
    });
  };

  const fretMarkers = [3, 5, 7, 9, 12, 15, 17, 19, 24];

  return (
    <div className="flex flex-col justify-between bg-[#f0e9e2] border border-[#c0b7a8] p-2.5 relative w-[113px] h-[300px]">
      {renderStrings()}
      {fretMarkers.includes(fretNumber) && <FretMarker />}
    </div>
  );
};

export default Fret;
