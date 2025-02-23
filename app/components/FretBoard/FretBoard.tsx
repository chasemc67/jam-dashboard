// FretBoard.tsx
import React from 'react';
import Fret from '../Fret';

export type FretBoardProps = {
  rootNotes: string[];
  numberOfFrets: number;
  startingFret: number;
  showTextNotes?: boolean;
  isLeftHanded?: boolean;
};

const FretBoard: React.FC<FretBoardProps> = ({
  rootNotes,
  numberOfFrets,
  startingFret,
  showTextNotes,
  isLeftHanded,
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
        />,
      );
    }
    return frets;
  };

  return <div className="flex">{renderFrets()}</div>;
};

export default FretBoard;
