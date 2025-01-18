import React, { useState } from 'react';
import { Chord } from 'tonal';
import ChordSelectionControls from '~/components/ChordSelectionControls';
import ScaleChordGrid from '~/components/ScaleChordGrid';
import { playChordSimultaneous } from '~/utils/audioUtils';
import {
  ChordTypeGroup,
  chordTypeGroups,
  getActiveChordTypes,
  INDIVIDUAL_NOTES,
} from '~/utils/chordPlayerUtils';

const ChordExplorer: React.FC = () => {
  const [selectedChordGroups, setSelectedChordGroups] = useState<
    ChordTypeGroup[]
  >([chordTypeGroups[0]]);

  const handleChordGroupChange = (
    selectedOptions: readonly ChordTypeGroup[],
  ) => {
    setSelectedChordGroups([...selectedOptions]);
  };

  const handleChordClick = (chordName: string) => {
    // If it's a chord (contains more than just a note name)
    if (chordName.length > 1 && chordName.match(/[A-G][b#]?[^A-G]/)) {
      const chordNotes = Chord.get(chordName).notes;
      playChordSimultaneous(chordNotes.map(note => `${note}4`));
    } else {
      // For single notes
      playChordSimultaneous([`${chordName}4`]);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-4">
        <ChordSelectionControls
          selectedChordGroups={selectedChordGroups}
          onChordGroupsChange={handleChordGroupChange}
        />

        <ScaleChordGrid
          onChordClick={handleChordClick}
          enabledChordTypes={getActiveChordTypes(selectedChordGroups)}
          showNoteRow={selectedChordGroups.some(
            group => group.label === INDIVIDUAL_NOTES,
          )}
        />
      </div>
    </div>
  );
};

export default ChordExplorer;
