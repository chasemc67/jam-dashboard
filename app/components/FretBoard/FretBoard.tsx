// FretBoard.tsx
import React from 'react';
import styled from 'styled-components';
import Fret, { HighlightedNote } from '../Fret';

const FretBoardContainer = styled.div`
  display: flex;
`;

export type FretBoardProps = {
  rootNotes: string[];
  highlightedNotes: HighlightedNote[];
  numberOfFrets: number;
  startingFret: number;
  showTextNotes?: boolean;
  isLeftHanded?: boolean;
};

const FretBoard: React.FC<FretBoardProps> = ({
  rootNotes,
  highlightedNotes,
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
          highlightedNotes={highlightedNotes}
          showTextNotes={showTextNotes}
        />,
      );
    }
    return frets;
  };

  return <FretBoardContainer>{renderFrets()}</FretBoardContainer>;
};

export default FretBoard;
