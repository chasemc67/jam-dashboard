import { type ReactNode } from 'react';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { HighlightedNotesProvider } from '~/contexts/HighlightedNotesContext';

interface ContextProvidersProps {
  children: ReactNode;
}

export function ContextProviders({ children }: ContextProvidersProps) {
  return (
    <SettingsProvider>
      <HighlightedNotesProvider>{children}</HighlightedNotesProvider>
    </SettingsProvider>
  );
}
