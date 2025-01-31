import React, { createContext, useContext, useState, useEffect } from 'react';
import type { HighlightedNote } from '~/components/Fret';
import { getColorForDegree } from '~/utils/noteColoringUtils';
import { useSettings } from './SettingsContext';

interface HighlightedNotesContextType {
  highlightedNotes: HighlightedNote[];
  setHighlightedNotes: (notes: HighlightedNote[]) => void;
  selectedKey: string;
  setSelectedKey: (key: string) => void;
  setKeyAndNotes: (key: string, scale: string[]) => void;
  setChordHighlighting: (chordNotes: string[]) => void;
  clearChordHighlighting: () => void;
}

const HighlightedNotesContext = createContext<
  HighlightedNotesContextType | undefined
>(undefined);

export function HighlightedNotesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { settings } = useSettings();
  const [highlightedNotes, setHighlightedNotes] = useState<HighlightedNote[]>([
    { note: 'C', color: 'red' },
    { note: 'D', color: 'blue' },
    { note: 'E', color: 'green' },
    { note: 'F', color: 'yellow' },
    { note: 'G', color: 'orange' },
    { note: 'A', color: 'purple' },
    { note: 'B', color: 'pink' },
  ]);
  const [selectedKey, setSelectedKey] = useState<string>('C major');

  // Update colors whenever quickColors setting changes
  useEffect(() => {
    if (highlightedNotes.length > 0) {
      const updatedNotes = highlightedNotes.map((note, index) => ({
        note: note.note,
        color: getColorForDegree(settings.quickColors, index + 1, selectedKey),
      }));
      setHighlightedNotes(updatedNotes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.quickColors]);

  const setKeyAndNotes = (key: string, scale: string[]) => {
    setSelectedKey(key);
    const newHighlightedNotes = scale.map((note, index) => ({
      note,
      color: getColorForDegree(settings.quickColors, index + 1, key),
    }));
    setHighlightedNotes(newHighlightedNotes);
  };

  const setChordHighlighting = (chordNotes: string[]) => {
    const newHighlightedNotes = highlightedNotes.map((note, index) => ({
      note: note.note,
      color: chordNotes.includes(note.note)
        ? getColorForDegree('scale', index + 1, selectedKey)
        : 'grey',
    }));
    setHighlightedNotes(newHighlightedNotes);
  };

  const clearChordHighlighting = () => {
    const newHighlightedNotes = highlightedNotes.map((note, index) => ({
      note: note.note,
      color: getColorForDegree(settings.quickColors, index + 1, selectedKey),
    }));
    setHighlightedNotes(newHighlightedNotes);
  };

  return (
    <HighlightedNotesContext.Provider
      value={{
        highlightedNotes,
        setHighlightedNotes,
        selectedKey,
        setSelectedKey,
        setKeyAndNotes,
        setChordHighlighting,
        clearChordHighlighting,
      }}
    >
      {children}
    </HighlightedNotesContext.Provider>
  );
}

export function useHighlightedNotes() {
  const context = useContext(HighlightedNotesContext);
  if (context === undefined) {
    throw new Error(
      'useHighlightedNotes must be used within a HighlightedNotesProvider',
    );
  }
  return context;
}
