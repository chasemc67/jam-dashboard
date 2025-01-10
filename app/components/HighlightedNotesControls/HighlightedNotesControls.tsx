// HighlightedNotesControls.tsx
import React, { useState } from 'react';
import styled from 'styled-components';
import { Scale, ScaleType } from 'tonal';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 20px;
`;

const TextInput = styled.input`
  width: 200px;
  height: 30px;
  margin-bottom: 10px;
`;

const NoteButton = styled.button<{ backgroundColor: string }>`
  width: 30px;
  height: 30px;
  background-color: ${props => props.backgroundColor};
  margin-right: 5px;
  color: white;
  font-weight: bold;
  border: none;
  cursor: pointer;
`;

const ButtonsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
`;

const ColorPicker = styled.select`
  width: 60%;
`;

const ScaleControls = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  align-items: center;
`;

const Select = styled.select`
  height: 30px;
  min-width: 100px;
`;

const Button = styled.button`
  height: 30px;
  padding: 0 15px;
  cursor: pointer;
`;

const DetectedScales = styled.div`
  margin: 10px 0;
  font-size: 0.9em;
  color: #666;
`;

const colors = [
  { name: 'Grey', value: 'grey' },
  { name: 'Blue', value: 'blue' },
  { name: 'Red', value: 'red' },
  { name: 'Green', value: 'green' },
  { name: 'Orange', value: 'orange' },
  { name: 'Brown', value: 'brown' },
  { name: 'Purple', value: 'purple' },
  { name: 'Teal', value: 'teal' },
];

const possibleRoots = [
  'C',
  'C#',
  'Db',
  'D',
  'D#',
  'Eb',
  'E',
  'F',
  'F#',
  'Gb',
  'G',
  'G#',
  'Ab',
  'A',
  'A#',
  'Bb',
  'B',
];

interface HighlightedNote {
  note: string;
  color: string;
}

export type HighlightedNotesControlsProps = {
  highlightedNotes: HighlightedNote[];
  setHighlightedNotes: (notes: HighlightedNote[]) => void;
};

const HighlightedNotesControls: React.FC<HighlightedNotesControlsProps> = ({
  highlightedNotes,
  setHighlightedNotes,
}) => {
  const [inputValue, setInputValue] = useState(
    highlightedNotes.map(n => n.note).join(', '),
  );
  const [selectedRoot, setSelectedRoot] = useState('C');
  const [selectedScaleType, setSelectedScaleType] = useState('major');
  const [detectedScales, setDetectedScales] = useState<string[]>([]);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    const notes = value
      .split(',')
      .map(note => {
        const trimmedNote = note.trim();
        if (!trimmedNote) return '';
        return (
          trimmedNote.charAt(0).toUpperCase() +
          trimmedNote.slice(1).toLowerCase()
        );
      })
      .filter(note => note);

    const updatedHighlightedNotes = notes.map(note => {
      const existingNote = highlightedNotes.find(n => n.note === note);
      return existingNote || { note, color: 'grey' };
    });

    setHighlightedNotes(updatedHighlightedNotes);
  };

  const handleScaleSelect = () => {
    const scaleName = `${selectedRoot} ${selectedScaleType}`;
    const scaleObj = Scale.get(scaleName);
    handleInputChange(scaleObj.notes.join(', '));
  };

  const handleDetectScales = () => {
    const notes = inputValue
      .split(',')
      .map(note => note.trim())
      .filter(note => note);
    const detected = Scale.detect(notes);
    setDetectedScales(detected);
  };

  const handleColorChange = (note: string, color: string) => {
    const updatedHighlightedNotes = highlightedNotes.map(n =>
      n.note === note ? { ...n, color } : n,
    );
    setHighlightedNotes(updatedHighlightedNotes);
  };

  const renderColorPicker = (note: string, currentColor: string) => (
    <ColorPicker
      value={currentColor}
      onChange={e => handleColorChange(note, e.target.value)}
    >
      {colors.map(color => (
        <option key={color.value} value={color.value}>
          {color.name}
        </option>
      ))}
    </ColorPicker>
  );

  return (
    <Container>
      <ScaleControls>
        <Select
          value={selectedRoot}
          onChange={e => setSelectedRoot(e.target.value)}
        >
          {possibleRoots.map(root => (
            <option key={root} value={root}>
              {root}
            </option>
          ))}
        </Select>
        <Select
          value={selectedScaleType}
          onChange={e => setSelectedScaleType(e.target.value)}
        >
          {ScaleType.all().map(scale => (
            <option key={scale.name} value={scale.name}>
              {scale.name}
            </option>
          ))}
        </Select>
        <Button onClick={handleScaleSelect}>Apply Scale</Button>
      </ScaleControls>

      <TextInput
        value={inputValue}
        onChange={e => handleInputChange(e.target.value)}
        placeholder="Enter comma-separated notes"
      />
      <Button onClick={handleDetectScales}>Detect Scales</Button>

      {detectedScales.length > 0 && (
        <DetectedScales>
          Matching scales: {detectedScales.join(', ')}
        </DetectedScales>
      )}

      <ButtonsContainer>
        {highlightedNotes.map((highlightedNote, index) => (
          <div key={index}>
            <NoteButton backgroundColor={highlightedNote.color}>
              {highlightedNote.note}
            </NoteButton>
            {renderColorPicker(highlightedNote.note, highlightedNote.color)}
          </div>
        ))}
      </ButtonsContainer>
    </Container>
  );
};

export default HighlightedNotesControls;
