// FretboardControls.tsx

import React, { useState } from 'react';
import FretBoard from '../FretBoard';
import { getNoteColorClass } from '~/utils/noteColors';
import { useHighlightedNotes } from '~/contexts/HighlightedNotesContext';
import { useSettings } from '~/contexts/SettingsContext';

const FretboardControls: React.FC = () => {
  const [rootNotes, setRootNotes] = useState(['E', 'B', 'G', 'D', 'A', 'E']);
  const { highlightedNotes } = useHighlightedNotes();
  const { settings } = useSettings();
  const [startingFret] = useState(0);

  const handleInputChange = (index: number, value: string) => {
    const processedValue =
      value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    const updatedRootNotes = [...rootNotes];
    updatedRootNotes[index] = processedValue;
    setRootNotes(updatedRootNotes);
  };

  const getOutlineColor = (note: string) => {
    const foundNote = highlightedNotes.find(n => n.note === note);
    return foundNote
      ? getNoteColorClass(foundNote.color, 'border')
      : 'border-black';
  };

  const renderInputs = () => {
    return rootNotes.map((note, index) => (
      <div key={index} className="flex items-start h-[calc(100%/6)]">
        <input
          value={note}
          onChange={e => handleInputChange(index, e.target.value)}
          className={`w-[30px] h-[30px] text-center border-[5px] ${getOutlineColor(note)}`}
        />
      </div>
    ));
  };

  return (
    <div>
      <div className="flex">
        <div
          className={`flex flex-col justify-between h-[330px] ${settings.isLefty ? 'order-1' : 'order-0'}`}
        >
          {renderInputs()}
        </div>
        <div className={settings.isLefty ? 'order-0' : 'order-1'}>
          <div className="max-w-[90vw] overflow-x-auto md:max-w-none md:overflow-visible">
            <div className="inline-flex">
              <FretBoard
                rootNotes={rootNotes}
                highlightedNotes={highlightedNotes}
                numberOfFrets={settings.numberOfFrets}
                startingFret={startingFret}
                showTextNotes={settings.showTextNotes}
                isLeftHanded={settings.isLefty}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FretboardControls;
