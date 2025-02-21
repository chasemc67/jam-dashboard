import { type ReactNode } from 'react';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { HighlightedNotesProvider } from '~/contexts/HighlightedNotesContext';
import { ScaleKeyProvider } from '~/contexts/ScaleKeyContext';

interface ContextProvidersProps {
  children: ReactNode;
}

export function ContextProviders({ children }: ContextProvidersProps) {
  return (
    <SettingsProvider>
      <ScaleKeyProvider>
        <HighlightedNotesProvider>{children}</HighlightedNotesProvider>
      </ScaleKeyProvider>
    </SettingsProvider>
  );
}
