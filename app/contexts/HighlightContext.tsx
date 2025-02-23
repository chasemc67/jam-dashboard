import React, { createContext, useContext, useState } from 'react';
import type { HighlightedNote } from '~/components/Fret';
import { useScaleKey } from './ScaleKeyContext';

type HighlightType = 'scale' | 'pentatonic' | 'CAGED';

interface HighlightContextType {
  getHighlightedNotes: () => HighlightedNote[];
  setChordHighlight: (notes: string[]) => void;
  clearChordHighlight: () => void;
  highlightType: HighlightType;
  setHighlightType: (type: HighlightType) => void;
}

const COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink'];

const HighlightContext = createContext<HighlightContextType | undefined>(
  undefined,
);

export function HighlightProvider({ children }: { children: React.ReactNode }) {
  const { notes, pentatonicNotes } = useScaleKey();
  const [highlightType, setHighlightType] = useState<HighlightType>('scale');
  const [chordHighlightNotes, setChordHighlightNotes] = useState<string[]>([]);

  const getHighlightedNotes = (): HighlightedNote[] => {
    // If there are chord highlight notes, prioritize those
    if (chordHighlightNotes.length > 0) {
      return notes.map((note, index) => ({
        note,
        color: chordHighlightNotes.includes(note)
          ? COLORS[index % COLORS.length]
          : 'grey',
      }));
    }

    // Default scale coloring logic
    const scaleColoring = notes.map((note, index) => ({
      note,
      color: COLORS[index % COLORS.length],
    }));

    switch (highlightType) {
      case 'pentatonic':
        // If no pentatonic notes available, fall back to scale coloring
        if (pentatonicNotes.length === 0) return scaleColoring;

        return notes.map((note, index) => ({
          note,
          color: pentatonicNotes.includes(note)
            ? COLORS[index % COLORS.length]
            : 'grey',
        }));

      case 'CAGED':
        // If no pentatonic notes available, fall back to scale coloring
        if (pentatonicNotes.length === 0) return scaleColoring;

        return notes.map(note => ({
          note,
          color: 'grey',
        }));

      case 'scale':
      default:
        return scaleColoring;
    }
  };

  const setChordHighlight = (notes: string[]) => {
    setChordHighlightNotes(notes);
  };

  const clearChordHighlight = () => {
    setChordHighlightNotes([]);
  };

  return (
    <HighlightContext.Provider
      value={{
        getHighlightedNotes,
        setChordHighlight,
        clearChordHighlight,
        highlightType,
        setHighlightType,
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
