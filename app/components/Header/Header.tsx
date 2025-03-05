import { KeyPicker } from '~/components/KeyPicker/KeyPicker';
import { cn } from '~/lib/utils';
import { Settings } from '~/components/Settings';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-accent">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              <DropdownMenuItem asChild>
                <Link to="/" className="flex items-center gap-2">
                  <Guitar className="h-4 w-4" />
                  <span>Fretboard</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/scales" className="flex items-center gap-2">
                  <Music className="h-4 w-4" />
                  <span>Scales</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/ear-training" className="flex items-center gap-2">
                  <Ear className="h-4 w-4" />
                  <span>Ear Training</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 hover:bg-accent"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              <DropdownMenuItem asChild>
                <Link to="/" className="flex items-center gap-2">
                  <Guitar className="h-4 w-4" />
                  <span>Fretboard</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/scales" className="flex items-center gap-2">
                  <Music className="h-4 w-4" />
                  <span>Scales</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/ear-training" className="flex items-center gap-2">
                  <Ear className="h-4 w-4" />
                  <span>Ear Training</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex-1 min-w-0">
            <KeyPicker />
          </div>
          <Settings />
        </div>
      </div>
    </header>
  );
}
