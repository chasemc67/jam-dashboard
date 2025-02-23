import { type ReactNode } from 'react';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { HighlightedNotesProvider } from '~/contexts/HighlightedNotesContext';
import { ScaleKeyProvider } from '~/contexts/ScaleKeyContext';
import { HighlightProvider } from '~/contexts/HighlightContext';
interface ContextProvidersProps {
  children: ReactNode;
}

export function ContextProviders({ children }: ContextProvidersProps) {
  return (
    <SettingsProvider>
      <ScaleKeyProvider>
        <HighlightProvider>
          <HighlightedNotesProvider>{children}</HighlightedNotesProvider>
        </HighlightProvider>
      </ScaleKeyProvider>
    </SettingsProvider>
  );
}
