// FretboardControls.tsx

import React, { useState } from 'react';
import styled from 'styled-components';
import FretBoard from '../FretBoard';
import HighlightedNotesControls from '../HighlightedNotesControls';
import { HighlightedNote } from '../Fret_backup';

const FretboardControlsContainer = styled.div`
  display: flex;
`;

const InputContainer = styled.div<{ isLeftHanded: boolean }>`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 330px;
  order: ${props => (props.isLeftHanded ? 1 : 0)};
`;

const FretBoardWrapper = styled.div<{ isLeftHanded: boolean }>`
  order: ${props => (props.isLeftHanded ? 0 : 1)};
`;

const TextInput = styled.input<{ borderColor: string }>`
  width: 30px;
  height: 30px;
  text-align: center;
  border: 5px solid ${props => props.borderColor};
`;

const StringInput = styled.div`
  display: flex;
  align-items: start;
  height: calc(100% / 6);
`;

const CheckboxContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 10px;
  gap: 5px;
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const NumberInputLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const NumberInput = styled.input`
  width: 60px;
`;

const FretboardControls: React.FC = () => {
  const [rootNotes, setRootNotes] = useState(['E', 'B', 'G', 'D', 'A', 'E']);
  const [highlightedNotes, setHighlightedNotes] = useState<HighlightedNote[]>([
    { note: 'C', color: 'blue' },
    { note: 'D', color: 'red' },
    { note: 'E', color: 'green' },
    { note: 'F', color: 'orange' },
    { note: 'G', color: 'brown' },
    { note: 'A', color: 'purple' },
    { note: 'B', color: 'teal' },
  ]);

  const [numberOfFrets, setNumberOfFrets] = useState(12);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [startingFret, setStartingFret] = useState(0);
  const [showTextNotes, setShowTextNotes] = useState(true);
  const [isLeftHanded, setIsLeftHanded] = useState(false);

  const handleInputChange = (index: number, value: string) => {
    const processedValue =
      value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    const updatedRootNotes = [...rootNotes];
    updatedRootNotes[index] = processedValue;
    setRootNotes(updatedRootNotes);
  };

  const getOutlineColor = (note: string) => {
    const foundNote = highlightedNotes.find(n => n.note === note);
    return foundNote ? foundNote.color : 'black';
  };

  const renderInputs = () => {
    return rootNotes.map((note, index) => (
      <StringInput key={index}>
        <TextInput
          value={note}
          onChange={e => handleInputChange(index, e.target.value)}
          borderColor={getOutlineColor(note)}
        />
      </StringInput>
    ));
  };

  return (
    <div>
      <FretboardControlsContainer>
        <InputContainer isLeftHanded={isLeftHanded}>
          {renderInputs()}
        </InputContainer>
        <FretBoardWrapper isLeftHanded={isLeftHanded}>
          <FretBoard
            rootNotes={rootNotes}
            highlightedNotes={highlightedNotes}
            numberOfFrets={numberOfFrets}
            startingFret={startingFret}
            showTextNotes={showTextNotes}
            isLeftHanded={isLeftHanded}
          />
        </FretBoardWrapper>
      </FretboardControlsContainer>
      <HighlightedNotesControls
        highlightedNotes={highlightedNotes}
        setHighlightedNotes={setHighlightedNotes}
      />
      <CheckboxContainer>
        <NumberInputLabel>
          Number of Frets:
          <NumberInput
            type="number"
            min="1"
            max="24"
            value={numberOfFrets}
            onChange={e => setNumberOfFrets(Number(e.target.value))}
          />
        </NumberInputLabel>
        <CheckboxLabel>
          <input
            type="checkbox"
            checked={isLeftHanded}
            onChange={() => setIsLeftHanded(!isLeftHanded)}
          />{' '}
          Left Handed
        </CheckboxLabel>
        <CheckboxLabel>
          <input
            type="checkbox"
            checked={showTextNotes}
            onChange={() => setShowTextNotes(!showTextNotes)}
          />
          Show Text Notes
        </CheckboxLabel>
      </CheckboxContainer>
    </div>
  );
};

export default FretboardControls;
