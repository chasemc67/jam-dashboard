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
  disabled?: boolean;
}

export const ScaleChordGrid: React.FC<ScaleChordGridProps> = ({
  onChordClick = (chord: string) => console.log(`Clicked chord: ${chord}`),
  enabledChordTypes,
  showNoteRow = true,
  disabled = false,
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
          <div className="grid grid-flow-col gap-0.5 mb-1">
            {chordsInScale.map(({ note }) => (
              <Button
                key={note}
                variant="secondary"
                className={cn(
                  'w-16 h-10 text-lg font-bold',
                  'hover:bg-primary hover:text-primary-foreground',
                  disabled && 'opacity-50 cursor-not-allowed',
                )}
                disabled={disabled}
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
            chords.some(chord => {
              if (!chord) return false;
              // Match the root note (letter + optional sharp(s)/flat) and get everything after
              const match = chord.match(/^[A-G][#b]{0,2}(.*)/);
              return match && match[1] === chordType;
            }),
          );

          // Skip rendering the row if no chords are supported
          if (!hasAnySupportedChords) return null;

          return (
            <div key={chordType} className="grid grid-flow-col gap-0.5 mb-1">
              {chordsInScale.map(({ note, chords }) => {
                const fullChordName = `${note}${chordType}`;
                const isSupported = chords.some(chord => {
                  if (!chord) return false;
                  const match = chord.match(/^[A-G][#b]{0,2}(.*)/);
                  return match && match[1] === chordType;
                });

                return (
                  <Button
                    key={`${note}-${chordType}`}
                    variant="secondary"
                    className={cn(
                      'w-16 h-10',
                      isSupported
                        ? 'hover:bg-primary hover:text-primary-foreground'
                        : 'opacity-25 cursor-not-allowed',
                      disabled && 'opacity-50 cursor-not-allowed',
                    )}
                    disabled={!isSupported || disabled}
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
