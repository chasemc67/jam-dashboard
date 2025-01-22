import React, { useState } from 'react';
import { Chord } from 'tonal';
import Player from '~/components/Player';
import { getEveryChordInScale, getEveryNoteInScale } from '~/utils/scaleChords';
import {
  ChordTypeGroup,
  chordTypeGroups,
  getActiveChordTypes,
  INDIVIDUAL_NOTES,
} from '~/utils/chordPlayerUtils';
import { addOctavesToChordNotes } from '~/utils/musicTheoryUtils';
import ChordSelectionControls from '~/components/ChordSelectionControls';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { useHighlightedNotes } from '~/contexts/HighlightedNotesContext';
import ScaleChordGrid from '~/components/ScaleChordGrid';

const TOTAL_ROUNDS = 10;

const RandomPlayer: React.FC = () => {
  const { selectedKey } = useHighlightedNotes();
  const [selectedChordGroups, setSelectedChordGroups] = useState<
    ChordTypeGroup[]
  >([chordTypeGroups[0]]);
  const [currentChord, setCurrentChord] = useState<string[]>([]);
  const [currentChordName, setCurrentChordName] = useState<string>('');
  const [showNotes, setShowNotes] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(
    null,
  );

  // Game state
  const [gameInProgress, setGameInProgress] = useState(false);
  const [correctGuesses, setCorrectGuesses] = useState(0);
  const [incorrectGuesses, setIncorrectGuesses] = useState(0);
  const [currentRound, setCurrentRound] = useState(0);

  const generateRandomChord = () => {
    if (!gameInProgress) {
      // Start new game
      setGameInProgress(true);
      setCorrectGuesses(0);
      setIncorrectGuesses(0);
      setCurrentRound(1);
    } else {
      // Move to next round if there are guesses
      if (feedback !== null) {
        setCurrentRound(prev => prev + 1);
      }
    }

    setFeedback(null);
    // Get all possible chords in the selected key
    const chordsInKey = getEveryChordInScale(
      selectedKey,
      getActiveChordTypes(selectedChordGroups),
    );

    // Flatten the array of chords and filter out any null values
    const allPossibleChords = chordsInKey
      .flatMap(noteChords => noteChords.chords)
      .filter((chord): chord is string => chord !== null);

    if (
      allPossibleChords.length === 0 &&
      !selectedChordGroups.some(group => group.label === INDIVIDUAL_NOTES)
    )
      return;

    // convert allPossibleChords into a new array with the chord name and array of notes
    const allPossibleChordsWithNotes = allPossibleChords.map(chord => {
      const chordNotes = Chord.get(chord).notes;
      return { chordName: chord, notes: chordNotes };
    });

    if (selectedChordGroups.some(group => group.label === INDIVIDUAL_NOTES)) {
      allPossibleChordsWithNotes.push(
        ...getEveryNoteInScale(selectedKey).map((note: string) => ({
          chordName: note,
          notes: [note],
        })),
      );
    }

    // Pick a random chord
    const randomChordWithNotes =
      allPossibleChordsWithNotes[
        Math.floor(Math.random() * allPossibleChordsWithNotes.length)
      ];

    const notesWithOctave = addOctavesToChordNotes(randomChordWithNotes.notes);

    setCurrentChord(notesWithOctave);
    setCurrentChordName(randomChordWithNotes.chordName);
    setShowNotes(false);
  };

  const handleChordGroupChange = (
    selectedOptions: readonly ChordTypeGroup[],
  ) => {
    setSelectedChordGroups([...selectedOptions]);
    setFeedback(null);
    setGameInProgress(false);
    setCurrentRound(0);
    setCorrectGuesses(0);
    setIncorrectGuesses(0);
  };

  const toggleNotes = () => {
    setShowNotes(!showNotes);
  };

  const checkAnswer = (chordName: string) => {
    if (!gameInProgress) return;

    const isCorrect = chordName === currentChordName;
    setFeedback(isCorrect ? 'correct' : 'incorrect');

    if (isCorrect) {
      setCorrectGuesses(prev => prev + 1);
    } else {
      setIncorrectGuesses(prev => prev + 1);
    }

    // End game if we've reached the total rounds
    if (currentRound >= TOTAL_ROUNDS) {
      setGameInProgress(false);
    }
  };

  return (
    <div className="space-y-6 px-6 pb-6">
      <div className="space-y-4 flex flex-col items-center">
        <div className="w-[90%]">
          <ChordSelectionControls
            selectedChordGroups={selectedChordGroups}
            onChordGroupsChange={handleChordGroupChange}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <Button onClick={generateRandomChord}>
                {!gameInProgress ? 'Start' : 'Next'}
              </Button>
              {gameInProgress && (
                <Button variant="outline" onClick={toggleNotes}>
                  {showNotes ? 'Hide' : 'Peek'}
                </Button>
              )}
            </div>

            {/* Game Progress Display */}
            {gameInProgress && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-600 dark:text-green-400 font-medium">
                  {correctGuesses} ✓
                </span>
                <span className="text-red-600 dark:text-red-400 font-medium">
                  {incorrectGuesses} ✗
                </span>
                <span className="text-muted-foreground">
                  {currentRound}/{TOTAL_ROUNDS}
                </span>
              </div>
            )}
          </div>
          <Separator className="w-full" />
          {gameInProgress && (
            <Player notes={currentChord} className="flex gap-2" />
          )}
          {feedback && (
            <span
              className={`font-medium ${feedback === 'correct' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
            >
              {feedback === 'correct' ? 'Correct!' : 'Incorrect, try again!'}
            </span>
          )}
        </div>

        {showNotes && (
          <div className="space-y-2 rounded-lg bg-muted p-4">
            <p className="text-sm font-medium">
              Chord/Note: {currentChordName}
            </p>
            <p className="text-sm text-muted-foreground">
              Notes: {currentChord.map(note => note.slice(0, -1)).join(' - ')}
            </p>
          </div>
        )}

        {gameInProgress && (
          <ScaleChordGrid
            onChordClick={checkAnswer}
            enabledChordTypes={getActiveChordTypes(selectedChordGroups)}
            showNoteRow={selectedChordGroups.some(
              group => group.label === INDIVIDUAL_NOTES,
            )}
          />
        )}
      </div>
    </div>
  );
};

export default RandomPlayer;
