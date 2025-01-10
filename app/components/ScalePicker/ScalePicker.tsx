import React, { useState, useEffect } from 'react';
import { Scale, ScaleType } from 'tonal';

interface ScalePickerProps {
  // optionally accept props such as defaultScale, styling, callbacks, etc.
}

export const ScalePicker: React.FC<ScalePickerProps> = () => {
  // Retrieve all known scale types from Tonal
  const allScaleTypes = ScaleType.all(); // This returns objects describing each scale

  // We also need a set of possible root notes to pick from
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

  const [selectedRoot, setSelectedRoot] = useState('C');
  const [selectedScaleTypeName, setSelectedScaleTypeName] = useState('major');
  const [scaleNotes, setScaleNotes] = useState<string[]>([]);

  // For detecting scales from user-entered notes
  const [userNotes, setUserNotes] = useState('');
  const [detectedScales, setDetectedScales] = useState<string[]>([]);

  // Compute notes in the chosen scale whenever root or scale type changes
  useEffect(() => {
    const scaleName = `${selectedRoot} ${selectedScaleTypeName}`;
    const scaleObj = Scale.get(scaleName);
    setScaleNotes(scaleObj.notes);
  }, [selectedRoot, selectedScaleTypeName]);

  // When user enters notes, see which scales they might match
  const handleDetectScales = () => {
    // Split user input on spaces or commas; remove blanks
    const noteArray = userNotes
      .split(/[\s,]+/)
      .map(n => n.trim())
      .filter(n => n);

    // Tonal provides a Scale.detect function:
    // If you want advanced detection, you can also iterate over ScaleType.all()
    // but this is the simplest approach.
    const found = Scale.detect(noteArray);
    setDetectedScales(found);
  };

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 400 }}>
      <h2>Select a Scale</h2>

      <div style={{ marginBottom: '1rem' }}>
        <label>Root note: </label>
        <select
          value={selectedRoot}
          onChange={e => setSelectedRoot(e.target.value)}
        >
          {possibleRoots.map(root => (
            <option key={root} value={root}>
              {root}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Scale type: </label>
        <select
          value={selectedScaleTypeName}
          onChange={e => setSelectedScaleTypeName(e.target.value)}
        >
          {allScaleTypes.map(scaleType => (
            <option key={scaleType.name} value={scaleType.name}>
              {scaleType.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Notes in scale: </label>
        <input
          type="text"
          readOnly
          value={scaleNotes.join(' ')}
          style={{ width: '100%' }}
        />
      </div>

      <hr />

      <h3>Detect Scale from Notes</h3>
      <p>Enter a few notes (e.g., "C E G"):</p>
      <input
        type="text"
        value={userNotes}
        onChange={e => setUserNotes(e.target.value)}
        style={{ width: '100%' }}
      />
      <button style={{ marginTop: '0.5rem' }} onClick={handleDetectScales}>
        Detect
      </button>

      {detectedScales.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <strong>Matching Scales:</strong>
          <ul>
            {detectedScales.map(s => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
