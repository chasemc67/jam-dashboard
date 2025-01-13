import React, { createContext, useContext, useState } from 'react';
import type { HighlightedNote } from '~/components/Fret';

const noteColors = [
  'red',
  'blue',
  'green',
  'yellow',
  'orange',
  'purple',
  'pink',
];

interface HighlightedNotesContextType {
  highlightedNotes: HighlightedNote[];
  setHighlightedNotes: (notes: HighlightedNote[]) => void;
  selectedKey: string;
  setSelectedKey: (key: string) => void;
  setKeyAndNotes: (key: string, scale: string[]) => void;
}

const HighlightedNotesContext = createContext<
  HighlightedNotesContextType | undefined
>(undefined);

export function HighlightedNotesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [highlightedNotes, setHighlightedNotes] = useState<HighlightedNote[]>([
    { note: 'C', color: 'red' },
    { note: 'D', color: 'blue' },
    { note: 'E', color: 'green' },
    { note: 'F', color: 'yellow' },
    { note: 'G', color: 'orange' },
    { note: 'A', color: 'purple' },
    { note: 'B', color: 'pink' },
  ]);
  const [selectedKey, setSelectedKey] = useState<string>('');

  const setKeyAndNotes = (key: string, scale: string[]) => {
    setSelectedKey(key);
    const newHighlightedNotes = scale.map((note, index) => ({
      note,
      color: noteColors[index % noteColors.length],
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
