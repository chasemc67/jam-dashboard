// HighlightedNotesControls.tsx
import React, { useState } from 'react';
import { Scale, ScaleType } from 'tonal';
import { cn } from '~/lib/utils';

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

  return (
    <div className="flex flex-col items-center mt-5">
      <div className="flex items-center gap-2.5 mb-4">
        <select
          value={selectedRoot}
          onChange={e => setSelectedRoot(e.target.value)}
          className="h-10 min-w-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {possibleRoots.map(root => (
            <option key={root} value={root}>
              {root}
            </option>
          ))}
        </select>
        <select
          value={selectedScaleType}
          onChange={e => setSelectedScaleType(e.target.value)}
          className="h-10 min-w-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {ScaleType.all().map(scale => (
            <option key={scale.name} value={scale.name}>
              {scale.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleScaleSelect}
          className="h-10 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Apply
        </button>
      </div>

      <input
        value={inputValue}
        onChange={e => handleInputChange(e.target.value)}
        placeholder="Enter comma-separated notes"
        className="w-[200px] h-10 mb-2.5 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />

      <button
        onClick={handleDetectScales}
        className="h-10 px-4 py-2 mb-2.5 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
      >
        Detect Scales
      </button>

      {detectedScales.length > 0 && (
        <div className="text-sm text-muted-foreground mb-2.5">
          Matching scales: {detectedScales.join(', ')}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {highlightedNotes.map((highlightedNote, index) => (
          <div key={index} className="flex items-center gap-2">
            <button
              className={cn(
                'w-8 h-8 rounded-md text-white font-bold',
                `bg-${highlightedNote.color}-500`,
              )}
            >
              {highlightedNote.note}
            </button>
            <select
              value={highlightedNote.color}
              onChange={e =>
                handleColorChange(highlightedNote.note, e.target.value)
              }
              className="h-8 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {colors.map(color => (
                <option key={color.value} value={color.value}>
                  {color.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HighlightedNotesControls;
