import React, { createContext, useContext, useState, useEffect } from 'react';
import type { HighlightedNote } from '~/components/Fret';
import { useScaleKey } from './ScaleKeyContext';
import { useSettings } from './SettingsContext';
import { getEveryChordInScale } from '~/utils/scaleChords';
import { areNotesEquivalent } from '~/utils/musicTheoryUtils';

interface HighlightContextType {
  getHighlightedNotes: () => HighlightedNote[];
  setChordHighlight: (notes: string[], scaleName?: string) => void;
  clearChordHighlight: () => void;
  chordHighlightNotes: string[];
  highlightRevision: number;
}

const COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink'];
export const INTERVALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const HighlightContext = createContext<HighlightContextType | undefined>(
  undefined,
);

export function HighlightProvider({ children }: { children: React.ReactNode }) {
  const { notes, pentatonicNotes, keyScale } = useScaleKey();
  const { settings, updateSettings } = useSettings();
  const [highlight, setHighlight] = useState({
    notes: [] as string[],
    scale: keyScale,
    revision: 0,
  });
  useEffect(() => {
    setHighlight(previous =>
      previous.scale === keyScale
        ? previous
        : { notes: [], scale: keyScale, revision: previous.revision + 1 },
    );
  }, [keyScale]);
  const chordHighlightNotes =
    highlight.scale === keyScale && !settings.cagedModeEnabled
      ? highlight.notes
      : [];

  const getHighlightedNotes = (): HighlightedNote[] => {
    // If there are chord highlight notes, prioritize those
    if (chordHighlightNotes.length > 0) {
      return notes.map((note, index) => ({
        note,
        color: chordHighlightNotes.some(n => areNotesEquivalent(n, note))
          ? COLORS[index % COLORS.length]
          : 'grey',
      }));
    }

    // Default scale coloring logic
    const scaleColoring = notes.map((note, index) => ({
      note,
      color: COLORS[index % COLORS.length],
    }));

    switch (settings.quickColors) {
      case 'major/minor roots': {
        const chordsByNote = getEveryChordInScale(keyScale, [
          'maj',
          'min',
          'dim',
        ]);
        return notes.map(note => {
          const chordInfo = chordsByNote.find(cn => cn.note === note);
          if (!chordInfo || chordInfo.chords.length === 0) {
            return { note, color: 'grey' };
          }
          // Check if any of the chords for this note are major/minor/diminished
          const hasMinor = chordInfo.chords.some(
            chord => chord && chord.includes('min'),
          );
          const hasMajor = chordInfo.chords.some(
            chord => chord && chord.includes('maj'),
          );
          const hasDiminished = chordInfo.chords.some(
            chord => chord && chord.includes('dim'),
          );

          if (hasMajor) return { note, color: 'blue' };
          if (hasMinor) return { note, color: 'red' };
          if (hasDiminished) return { note, color: 'purple' };
          return { note, color: 'grey' };
        });
      }

      case 'pentatonic':
        // If no pentatonic notes available, fall back to scale coloring
        if (pentatonicNotes.length === 0) return scaleColoring;

        return notes.map((note, index) => ({
          note,
          color: pentatonicNotes.includes(note)
            ? COLORS[index % COLORS.length]
            : 'grey',
        }));

      case 'scale':
      default:
        return scaleColoring;
    }
  };

  const setChordHighlight = (notes: string[], scaleName = keyScale) => {
    setHighlight(previous => ({
      notes,
      scale: scaleName,
      revision: previous.revision + 1,
    }));
    if (notes.length) updateSettings({ cagedModeEnabled: false });
  };

  const clearChordHighlight = () => {
    setHighlight(previous => ({
      notes: [],
      scale: keyScale,
      revision: previous.revision + 1,
    }));
  };

  return (
    <HighlightContext.Provider
      value={{
        getHighlightedNotes,
        setChordHighlight,
        clearChordHighlight,
        chordHighlightNotes,
        highlightRevision: highlight.revision,
      }}
    >
      {children}
    </HighlightContext.Provider>
  );
}

export function useHighlight() {
  const context = useContext(HighlightContext);
  if (context === undefined) {
    throw new Error('useHighlight must be used within a HighlightProvider');
  }
  return context;
}
