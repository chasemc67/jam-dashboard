import React, { createContext, useContext, useState } from 'react';
import type { HighlightedNote } from '~/components/Fret';

interface HighlightedNotesContextType {
  highlightedNotes: HighlightedNote[];
  setHighlightedNotes: (notes: HighlightedNote[]) => void;
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

  return (
    <HighlightedNotesContext.Provider
      value={{ highlightedNotes, setHighlightedNotes }}
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
