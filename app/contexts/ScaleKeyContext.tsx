import React, { createContext, useContext, useState } from 'react';
import { Scale } from 'tonal';

interface ScaleKeyContextType {
  key: string;
  scale: string;
  notes: string[];
  pentatonicNotes: string[];
  setKey: (key: string) => void;
  setScale: (scale: string) => void;
  setKeyScale: (key: string, scale: string) => void;
}

const ScaleKeyContext = createContext<ScaleKeyContextType | undefined>(
  undefined,
);

export function ScaleKeyProvider({ children }: { children: React.ReactNode }) {
  const [key, setKey] = useState<string>('C');
  const [scale, setScale] = useState<string>('major');
  const [notes, setNotes] = useState<string[]>(Scale.get('C major').notes);
  const [pentatonicNotes, setPentatonicNotes] = useState<string[]>(
    Scale.get('C major pentatonic').notes || [],
  );

  const updateScaleData = (newKey: string, newScale: string) => {
    const fullScale = `${newKey} ${newScale}`;
    const scaleNotes = Scale.get(fullScale).notes;
    setNotes(scaleNotes);

    // Try to get pentatonic notes, default to empty array if not available
    const pentatonicScale = `${newKey} ${newScale} pentatonic`;
    const pentatonic = Scale.get(pentatonicScale);
    setPentatonicNotes(pentatonic.empty ? [] : pentatonic.notes);
  };

  const handleSetKey = (newKey: string) => {
    setKey(newKey);
    updateScaleData(newKey, scale);
  };

  const handleSetScale = (newScale: string) => {
    setScale(newScale);
    updateScaleData(key, newScale);
  };

  const handleSetKeyScale = (newKey: string, newScale: string) => {
    setKey(newKey);
    setScale(newScale);
    updateScaleData(newKey, newScale);
  };

  return (
    <ScaleKeyContext.Provider
      value={{
        key,
        scale,
        notes,
        pentatonicNotes,
        setKey: handleSetKey,
        setScale: handleSetScale,
        setKeyScale: handleSetKeyScale,
      }}
    >
      {children}
    </ScaleKeyContext.Provider>
  );
}

export function useScaleKey() {
  const context = useContext(ScaleKeyContext);
  if (context === undefined) {
    throw new Error('useScaleKey must be used within a ScaleKeyProvider');
  }
  return context;
}
