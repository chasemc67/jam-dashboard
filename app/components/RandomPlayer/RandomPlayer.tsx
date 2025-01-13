import React, { useState } from 'react';
import { Chord } from 'tonal';
import Player from '~/components/Player';
import { getEveryChordInScale } from '~/utils/scaleChords';
import {
  ChordTypeGroup,
  chordTypeGroups,
  getActiveChordTypes,
} from '~/utils/chordPlayerUtils';
import ChordSelectionControls from '~/components/ChordSelectionControls';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { useHighlightedNotes } from '~/contexts/HighlightedNotesContext';

const RandomPlayer: React.FC = () => {
  const { selectedKey } = useHighlightedNotes();
  const [selectedChordGroups, setSelectedChordGroups] = useState<
    ChordTypeGroup[]
  >([chordTypeGroups[0]]);
  const [currentChord, setCurrentChord] = useState<string[]>([
    'C4',
    'E4',
    'G4',
  ]); // C major chord as default
  const [currentChordName, setCurrentChordName] = useState<string>('C major');
  const [showNotes, setShowNotes] = useState<boolean>(false);

  const generateRandomChord = () => {
    // Get all possible chords in the selected key
    const chordsInKey = getEveryChordInScale(
      selectedKey,
      getActiveChordTypes(selectedChordGroups),
    );

    // Flatten the array of chords and filter out any null values
    const allPossibleChords = chordsInKey
      .flatMap(noteChords => noteChords.chords)
      .filter((chord): chord is string => chord !== null);

    if (allPossibleChords.length === 0) return;

    // Pick a random chord
    const randomChord =
      allPossibleChords[Math.floor(Math.random() * allPossibleChords.length)];

    // Get the notes of the chord using Tonal
    const chordNotes = Chord.get(randomChord).notes;

    // Convert to the format needed by the Player (adding octave 4)
    const notesWithOctave = chordNotes.map(note => `${note}4`);

    setCurrentChord(notesWithOctave);
    setCurrentChordName(randomChord);
  };

  const handleChordGroupChange = (
    selectedOptions: readonly ChordTypeGroup[],
  ) => {
    setSelectedChordGroups([...selectedOptions]);
  };

  const toggleNotes = () => {
    setShowNotes(!showNotes);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Ear Training</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <ChordSelectionControls
            selectedChordGroups={selectedChordGroups}
            onChordGroupsChange={handleChordGroupChange}
          />

          <div className="flex gap-2">
            <Button onClick={generateRandomChord}>Generate</Button>
            <Button variant="outline" onClick={toggleNotes}>
              {showNotes ? 'Hide' : 'Reveal'}
            </Button>
          </div>

          {showNotes && (
            <div className="space-y-2 rounded-lg bg-muted p-4">
              <p className="text-sm font-medium">Chord: {currentChordName}</p>
              <p className="text-sm text-muted-foreground">
                Notes: {currentChord.map(note => note.slice(0, -1)).join(' - ')}
              </p>
            </div>
          )}
        </div>
        <Player notes={currentChord} />
      </CardContent>
    </Card>
  );
};

export default RandomPlayer;
