import { Button } from '~/components/ui/button';
import { Settings } from 'lucide-react';
import { KeyPicker } from '~/components/KeyPicker/KeyPicker';
import { cn } from '~/lib/utils';

export default function Header() {
  return (
    <header
      className={cn(
        'w-full border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        'border-b',
        // Ensure header stays above other UI elements
        'z-50',
      )}
    >
      {/* Desktop Layout */}
      <div className="hidden md:flex container h-14 max-w-none items-center px-8">
        <div className="mr-4 flex">
          <h1 className="text-xl font-bold text-primary">Jam Dashboard</h1>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <KeyPicker />
        </div>
        <div className="flex items-center justify-end space-x-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden container h-14 max-w-none">
        <div className="flex h-full items-center justify-around px-4">
          <KeyPicker />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
