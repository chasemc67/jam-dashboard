import { type ReactNode } from 'react';
import { SettingsProvider } from '~/contexts/SettingsContext';
import { ScaleKeyProvider } from '~/contexts/ScaleKeyContext';
import { HighlightProvider } from '~/contexts/HighlightContext';
import { AgentProvider } from '~/contexts/AgentContext';
interface ContextProvidersProps {
  children: ReactNode;
}

export function ContextProviders({ children }: ContextProvidersProps) {
  return (
    <SettingsProvider>
      <ScaleKeyProvider>
        <HighlightProvider>
          <AgentProvider>{children}</AgentProvider>
        </HighlightProvider>
      </ScaleKeyProvider>
    </SettingsProvider>
  );
}
