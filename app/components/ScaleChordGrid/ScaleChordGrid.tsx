import React from 'react';
import { Button } from '~/components/ui/button';
import { useHighlightedNotes } from '~/contexts/HighlightedNotesContext';
import { getEveryChordInScale } from '~/utils/scaleChords';
import { cn } from '~/lib/utils';

export interface ScaleChordGridProps {
  onChordClick?: (chord: string) => void;
  enabledChordTypes?: string[];
  showNoteRow?: boolean;
}

export const ScaleChordGrid: React.FC<ScaleChordGridProps> = ({
  onChordClick = (chord: string) => console.log(`Clicked chord: ${chord}`),
  enabledChordTypes,
  showNoteRow = true,
}) => {
  const { selectedKey } = useHighlightedNotes();
  const chordsInScale = selectedKey ? getEveryChordInScale(selectedKey) : [];

  // Get all unique chord types from all notes
  const allChordTypes = Array.from(
    new Set(
      chordsInScale.flatMap(noteChords =>
        noteChords.chords.map(
          chord => chord?.slice(noteChords.note.length) as string,
        ),
      ),
    ),
  ).sort();

  // Filter chord types if enabledChordTypes is provided
  const displayedChordTypes = enabledChordTypes
    ? allChordTypes.filter(type => enabledChordTypes.includes(type))
    : allChordTypes;

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-max">
        {/* Grid header with notes */}
        {showNoteRow && (
          <div className="grid grid-flow-col gap-2 mb-2">
            <div className="w-20" /> {/* Empty cell for chord type labels */}
            {chordsInScale.map(({ note }) => (
              <Button
                key={note}
                variant="secondary"
                className={cn(
                  'w-20 h-20 text-lg font-bold',
                  'hover:bg-primary hover:text-primary-foreground',
                )}
                onClick={() => onChordClick(note)}
              >
                {note}
              </Button>
            ))}
          </div>
        )}

        {/* Grid rows for each chord type */}
        {displayedChordTypes.map(chordType => (
          <div key={chordType} className="grid grid-flow-col gap-2 mb-2">
            <div className="w-20 flex items-center justify-end pr-2 font-medium text-sm">
              {chordType}
            </div>
            {chordsInScale.map(({ note, chords }) => {
              const fullChordName = `${note}${chordType}`;
              const isSupported = chords.includes(fullChordName);

              return (
                <Button
                  key={`${note}${chordType}`}
                  variant="secondary"
                  className={cn(
                    'w-20 h-20',
                    isSupported
                      ? 'hover:bg-primary hover:text-primary-foreground'
                      : 'opacity-25 cursor-not-allowed',
                  )}
                  disabled={!isSupported}
                  onClick={() => isSupported && onChordClick(fullChordName)}
                >
                  {fullChordName}
                </Button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScaleChordGrid;
