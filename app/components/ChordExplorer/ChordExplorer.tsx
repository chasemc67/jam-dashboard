import React, { useState } from 'react';
import { Chord } from 'tonal';
import { Volume2, VolumeX } from 'lucide-react';
import ChordSelectionControls from '~/components/ChordSelectionControls';
import ScaleChordGrid from '~/components/ScaleChordGrid';
import { playChordSimultaneous } from '~/utils/audioUtils';
import {
  ChordTypeGroup,
  chordTypeGroups,
  getActiveChordTypes,
  INDIVIDUAL_NOTES,
} from '~/utils/chordPlayerUtils';
import {
  addOctavesToChordNotes,
  areNotesEquivalent,
} from '~/utils/musicTheoryUtils';
import { useHighlightedNotes } from '~/contexts/HighlightedNotesContext';
import { getNoteColorClass } from '~/utils/noteColors';
import { Button } from '~/components/ui/button';

const ChordExplorer: React.FC = () => {
  const [selectedChordGroups, setSelectedChordGroups] = useState<
    ChordTypeGroup[]
  >([chordTypeGroups[0], chordTypeGroups[1]]);
  const [lastClickedChord, setLastClickedChord] = useState<{
    name: string;
    notes: string[];
  } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const { highlightedNotes, setChordHighlighting, clearChordHighlighting } =
    useHighlightedNotes();

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
      setChordHighlighting(chordNotes);
      if (!isMuted) {
        playChordSimultaneous(addOctavesToChordNotes(chordNotes));
      }
    } else {
      // For single notes
      setLastClickedChord({ name: chordName, notes: [chordName] });
      setChordHighlighting([chordName]);
      if (!isMuted) {
        playChordSimultaneous(addOctavesToChordNotes([chordName]));
      }
    }
  };

  return (
    <div className="space-y-6 px-6 pb-6">
      <div className="space-y-4">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <ChordSelectionControls
              selectedChordGroups={selectedChordGroups}
              onChordGroupsChange={handleChordGroupChange}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsMuted(!isMuted)}
            className="mt-4"
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
        </div>

        {lastClickedChord && (
          <div className="flex items-center justify-center gap-4 text-sm">
            <span className="text-muted-foreground font-medium">
              {lastClickedChord.name}:
            </span>
            <div className="flex items-center gap-2">
              {lastClickedChord.notes.map((note, index) => {
                // Find matching highlighted note to get its color
                const highlightedNote = highlightedNotes.find(hn =>
                  areNotesEquivalent(hn.note, note),
                );
                return (
                  <span
                    key={index}
                    className={`rounded-md w-5 h-5 flex items-center justify-center text-muted ${
                      highlightedNote
                        ? getNoteColorClass(highlightedNote.color, 'background')
                        : 'bg-note-grey'
                    }`}
                  >
                    {note}
                  </span>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearChordHighlighting();
                setLastClickedChord(null);
              }}
            >
              Clear
            </Button>
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
