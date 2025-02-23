import React, { createContext, useContext, useState, useEffect } from 'react';
import { z } from 'zod';
import { COLORING_PATTERN_CHOICES } from '~/utils/noteColoringUtils';

// Define Zod schema for our settings
const SettingsSchema = z.object({
  isLefty: z.boolean(),
  numberOfFrets: z.number().min(1).max(24),
  numberOfStrings: z.number().min(4).max(8),
  showTextNotes: z.boolean(),
  quickColors: z.enum(COLORING_PATTERN_CHOICES),
  cagedModeEnabled: z.boolean(),
  cagedShape: z.enum(['C', 'A', 'G', 'E', 'D']),
  showMajorMinorScales: z.boolean(),
  showHarmonicMelodicScales: z.boolean(),
  showModes: z.boolean(),
});

type Settings = z.infer<typeof SettingsSchema>;

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
  showMajorMinorScales: true,
  showHarmonicMelodicScales: false,
  showModes: false,
};

// Helper function to safely parse stored settings
const getStoredSettings = (): Settings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultSettings;

    const parsedJson = JSON.parse(stored);

    // Validate the parsed data against our schema
    const validationResult = SettingsSchema.safeParse({
      ...defaultSettings, // Include defaults first
      ...parsedJson, // Then overlay stored values
    });

    if (!validationResult.success) {
      console.warn('Invalid settings in localStorage:', validationResult.error);
      return defaultSettings;
    }

    return validationResult.data;
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
