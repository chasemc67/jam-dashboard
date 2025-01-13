// FretboardControls.tsx

import React, { useState } from 'react';
import FretBoard from '../FretBoard';
import { getNoteColorClass } from '~/utils/noteColors';
import { useHighlightedNotes } from '~/contexts/HighlightedNotesContext';

const FretboardControls: React.FC = () => {
  const [rootNotes, setRootNotes] = useState(['E', 'B', 'G', 'D', 'A', 'E']);
  const { highlightedNotes } = useHighlightedNotes();
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
          className={`flex flex-col justify-between h-[330px] ${isLeftHanded ? 'order-1' : 'order-0'}`}
        >
          {renderInputs()}
        </div>
        <div className={isLeftHanded ? 'order-0' : 'order-1'}>
          <div className="max-w-[90vw] overflow-x-auto md:max-w-none md:overflow-visible">
            <div className="inline-flex">
              <FretBoard
                rootNotes={rootNotes}
                highlightedNotes={highlightedNotes}
                numberOfFrets={numberOfFrets}
                startingFret={startingFret}
                showTextNotes={showTextNotes}
                isLeftHanded={isLeftHanded}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col mt-2.5 gap-1.5">
        <label className="flex items-center gap-1.5">
          Number of Frets:
          <input
            type="number"
            min="1"
            max="24"
            value={numberOfFrets}
            onChange={e => setNumberOfFrets(Number(e.target.value))}
            className="w-[60px]"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={isLeftHanded}
            onChange={() => setIsLeftHanded(!isLeftHanded)}
          />
          Left Handed
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={showTextNotes}
            onChange={() => setShowTextNotes(!showTextNotes)}
          />
          Show Text Notes
        </label>
      </div>
    </div>
  );
};

export default FretboardControls;
