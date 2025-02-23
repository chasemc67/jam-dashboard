import React, { createContext, useContext, useState } from 'react';
import type { HighlightedNote } from '~/components/Fret';
import { useScaleKey } from './ScaleKeyContext';
import { useSettings } from './SettingsContext';

interface HighlightContextType {
  getHighlightedNotes: () => HighlightedNote[];
  setChordHighlight: (notes: string[]) => void;
  clearChordHighlight: () => void;
  chordHighlightNotes: string[];
}

const COLORS = ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink'];

const HighlightContext = createContext<HighlightContextType | undefined>(
  undefined,
);

export function HighlightProvider({ children }: { children: React.ReactNode }) {
  const { notes, pentatonicNotes } = useScaleKey();
  const { settings } = useSettings();
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

    // If CAGED mode is enabled, override other colorings
    if (settings.cagedModeEnabled) {
      return notes.map(note => ({
        note,
        color: 'grey',
      }));
    }

    switch (settings.quickColors) {
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
        chordHighlightNotes,
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
