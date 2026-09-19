// FretBoard.tsx
import React from 'react';
import Fret from '../Fret';
import type { Position } from '../../../shared/music/voicings';

export type FretBoardProps = {
  rootNotes: string[];
  numberOfFrets: number;
  startingFret: number;
  showTextNotes?: boolean;
  isLeftHanded?: boolean;
  /** When supplied, show only these exact locations instead of pitch-class highlights. */
  positions?: Position[];
};

const FretBoard: React.FC<FretBoardProps> = ({
  rootNotes,
  numberOfFrets,
  startingFret,
  showTextNotes,
  isLeftHanded,
  positions,
}) => {
  const renderFrets = () => {
    const frets = [];

    let i = isLeftHanded ? numberOfFrets - 1 : 0;
    const increment = isLeftHanded ? -1 : 1;
    const compare = (j: number) => (isLeftHanded ? j >= 0 : j < numberOfFrets);

    for (; compare(i); i += increment) {
      frets.push(
        <Fret
          key={i}
          rootNotes={rootNotes}
          fretNumber={startingFret + i + 1}
          showTextNotes={showTextNotes}
          positions={positions}
        />,
      );
    }
    return frets;
  };

  return (
    <div className="flex pb-6" aria-label="Guitar fretboard">
      {renderFrets()}
    </div>
  );
};

export default FretBoard;
