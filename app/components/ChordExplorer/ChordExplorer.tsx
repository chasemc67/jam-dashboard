import React, { useState } from 'react';
import { Chord } from 'tonal';
import ChordSelectionControls from '~/components/ChordSelectionControls';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import ScaleChordGrid from '~/components/ScaleChordGrid';
import About from '~/components/About';
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
    <Card className="w-full max-w-[750px]">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Chord Explorer</CardTitle>
        <About />
      </CardHeader>
      <CardContent className="space-y-6">
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
      </CardContent>
    </Card>
  );
};

export default ChordExplorer;
