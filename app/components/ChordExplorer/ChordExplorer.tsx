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
import { addOctavesToChordNotes } from '~/utils/musicTheoryUtils';

const ChordExplorer: React.FC = () => {
  const [selectedChordGroups, setSelectedChordGroups] = useState<
    ChordTypeGroup[]
  >([chordTypeGroups[0]]);
  const [lastClickedChord, setLastClickedChord] = useState<{
    name: string;
    notes: string[];
  } | null>(null);

  const handleChordGroupChange = (
    selectedOptions: readonly ChordTypeGroup[],
  ) => {
    setSelectedChordGroups([...selectedOptions]);
  };

  const handleChordClick = (chordName: string) => {
    // If it's a chord (contains more than just a note name)
    if (chordName.length > 1 && chordName.match(/[A-G][b#]?[^A-G]/)) {
      const chordNotes = Chord.get(chordName).notes;
      setLastClickedChord({ name: chordName, notes: chordNotes });
      playChordSimultaneous(addOctavesToChordNotes(chordNotes));
    } else {
      // For single notes
      setLastClickedChord({ name: chordName, notes: [chordName] });
      playChordSimultaneous(addOctavesToChordNotes([chordName]));
    }
  };

  return (
    <div className="space-y-6 px-6 pb-6">
      <div className="space-y-4">
        <ChordSelectionControls
          selectedChordGroups={selectedChordGroups}
          onChordGroupsChange={handleChordGroupChange}
        />

        {lastClickedChord && (
          <div className="flex items-center justify-center gap-4 text-sm">
            <span className="text-muted-foreground font-medium">
              {lastClickedChord.name}:
            </span>
            <span className="text-green-600 dark:text-green-400 font-medium">
              {lastClickedChord.notes.join(' - ')}
            </span>
          </div>
        )}

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
