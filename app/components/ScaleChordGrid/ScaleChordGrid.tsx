import React from 'react';
import { Button } from '~/components/ui/button';
import { useHighlightedNotes } from '~/contexts/HighlightedNotesContext';
import { getEveryChordInScale } from '~/utils/scaleChords';
import { cn } from '~/lib/utils';
import { chordTypesCurated } from '~/utils/chordTypesCurated';

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

  // Use chordTypesCurated for ordering, filtered by enabledChordTypes if provided
  const displayedChordTypes = enabledChordTypes
    ? chordTypesCurated.filter(type => enabledChordTypes.includes(type))
    : chordTypesCurated;

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
        {displayedChordTypes.map(chordType => {
          // Check if any chord in this row is supported
          const hasAnySupportedChords = chordsInScale.some(({ chords }) =>
            chords.includes(`${chords[0]?.charAt(0)}${chordType}`),
          );

          // Skip rendering the row if no chords are supported
          if (!hasAnySupportedChords) return null;

          return (
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
          );
        })}
      </div>
    </div>
  );
};

export default ScaleChordGrid;
