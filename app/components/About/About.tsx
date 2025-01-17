import { Info } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';

export default function About() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="About"
        >
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>About Jam Dashboard</DialogTitle>
          <DialogDescription>
            Jam Dashboard is a web application designed to help musicians learn
            and practice guitar. It features a fretboard visualizer, key picker,
            and various tools for ear training and music theory practice.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <h4 className="font-medium">Key Features</h4>
            <ul className="list-disc pl-4 text-sm text-muted-foreground">
              <li>Interactive fretboard visualization</li>
              <li>Key and scale detection</li>
              <li>Customizable string tunings</li>
              <li>Note and chord playback</li>
              <li>Scale and chord suggestions</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
