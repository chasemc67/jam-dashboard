import { type ReactNode } from 'react';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { ScaleKeyProvider } from '~/contexts/ScaleKeyContext';
import { HighlightProvider } from '~/contexts/HighlightContext';
interface ContextProvidersProps {
  children: ReactNode;
}

export function ContextProviders({ children }: ContextProvidersProps) {
  return (
    <SettingsProvider>
      <ScaleKeyProvider>
        <HighlightProvider>{children}</HighlightProvider>
      </ScaleKeyProvider>
    </SettingsProvider>
  );
}
