import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ColoringPatternType } from '~/utils/noteColoringUtils';

interface Settings {
  isLefty: boolean;
  numberOfFrets: number;
  numberOfStrings: number;
  showTextNotes: boolean;
  quickColors: ColoringPatternType;
  cagedModeEnabled: boolean;
  cagedShape: 'C' | 'A' | 'G' | 'E' | 'D';
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

const STORAGE_KEY = 'jam-dashboard-settings';

const defaultSettings: Settings = {
  isLefty: false,
  numberOfFrets: 12,
  numberOfStrings: 6,
  showTextNotes: true,
  quickColors: 'scale',
  cagedModeEnabled: false,
  cagedShape: 'C',
};

// Helper function to safely parse stored settings
const getStoredSettings = (): Settings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultSettings;

    // Merge stored settings with defaults to ensure all fields exist
    const parsedSettings = JSON.parse(stored);
    return {
      ...defaultSettings,
      ...parsedSettings,
    };
  } catch (error) {
    console.error('Error reading settings from localStorage:', error);
    return defaultSettings;
  }
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    const storedSettings = getStoredSettings();
    setSettings(storedSettings);
    setIsInitialized(true);
  }, []);

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    if (!isInitialized) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings to localStorage:', error);
    }
  }, [settings, isInitialized]);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prev => ({
      ...prev,
      ...newSettings,
    }));
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
