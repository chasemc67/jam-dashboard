import { KeyPicker } from '~/components/KeyPicker/KeyPicker';
import { cn } from '~/lib/utils';
import { Settings } from '~/components/Settings';
import { Button } from '~/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '~/components/ui/sheet';
import { Menu, Guitar, Music, Ear } from 'lucide-react';
import { Link } from '@remix-run/react';

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
        <div className="mr-4 flex items-center gap-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-accent">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <nav className="flex flex-col gap-4">
                <Link
                  to="/"
                  className="flex items-center gap-2 text-lg font-semibold hover:text-primary"
                >
                  <Guitar className="h-5 w-5" />
                  Fretboard
                </Link>
                <Link
                  to="/scales"
                  className="flex items-center gap-2 text-lg font-semibold hover:text-primary"
                >
                  <Music className="h-5 w-5" />
                  Scales
                </Link>
                <Link
                  to="/ear-training"
                  className="flex items-center gap-2 text-lg font-semibold hover:text-primary"
                >
                  <Ear className="h-5 w-5" />
                  Ear Training
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
          <h1 className="text-xl font-bold text-primary">Jam Dashboard</h1>
        </div>
        <div className="flex flex-1 items-center justify-center space-x-2">
          <KeyPicker />
          <Settings />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden container h-14 max-w-none">
        <div className="flex h-full items-center gap-2 px-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 hover:bg-accent"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <nav className="flex flex-col gap-4">
                <Link
                  to="/"
                  className="flex items-center gap-2 text-lg font-semibold hover:text-primary"
                >
                  <Guitar className="h-5 w-5" />
                  Fretboard
                </Link>
                <Link
                  to="/scales"
                  className="flex items-center gap-2 text-lg font-semibold hover:text-primary"
                >
                  <Music className="h-5 w-5" />
                  Scales
                </Link>
                <Link
                  to="/ear-training"
                  className="flex items-center gap-2 text-lg font-semibold hover:text-primary"
                >
                  <Ear className="h-5 w-5" />
                  Ear Training
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
          <div className="flex-1 min-w-0">
            <KeyPicker />
          </div>
          <Settings />
        </div>
      </div>
    </header>
  );
}
