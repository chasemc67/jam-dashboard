// FretboardControls.tsx

import React, { FunctionComponent, useState } from 'react';
import styled from 'styled-components';
import FretBoard, { FretBoardProps } from '../FretBoard';
import HighlightedNotesControls from '../HighlightedNotesControls';
import { HighlightedNote } from '../Fret';

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
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const FretboardControls: FunctionComponent = () => {
  const [rootNotes, setRootNotes] = useState(['E', 'A', 'D', 'G', 'B', 'E']);
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
  const [startingFret, setStartingFret] = useState(0);
  const [showTextNotes, setShowTextNotes] = useState(true);
  const [isLeftHanded, setIsLeftHanded] = useState(false);
const [inputFocus, setInputFocus] = useState(-1);

  const handleInputChange = (index: number, value: string) => {
    const updatedRootNotes = [...rootNotes];
    updatedRootNotes[index] = value;
    setRootNotes(updatedRootNotes);
    setInputFocus(-1); // Revert inputFocus to -1 after the input value has been changed
  };

  const getOutlineColor = (note: string) => {
    const foundNote = highlightedNotes.find(n => n.note === note);
    return foundNote ? foundNote.color : 'black';
  };

  const renderInputs = () => {
    return rootNotes.map((note, index) => (
      <StringInput key={index}>
        <TextInput
  value={inputFocus === index ? '' : note} // Value is empty if the input is in focus
  onFocus={() => setInputFocus(index)} // OnFocus event added to set the focused input's index
  onBlur={() => {  // onBlur event added to revert to the initial value if no new value is entered
    if (note === '') {
      handleInputChange(index, rootNotes[index]);
    }
  }}
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
