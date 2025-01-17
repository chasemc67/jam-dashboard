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
          <DialogTitle>About</DialogTitle>
          <DialogDescription>
            Jam Dashboard is a compact tool for practicing advanced guitar
            concepts.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <h4 className="font-medium">How to use</h4>
            <ul className="list-disc pl-4 text-sm text-muted-foreground">
              <li>
                Start with the key selector at the top, this drives the key for
                the whole page
              </li>
              <li>
                The key selector also doubles as a key detector! Enter a handful
                of notes in the search box to filter to keys which contain those
                notes
              </li>
              <li>
                Visualize different types of scales on the fretboard using the
                Quick Colors in settings. We recommend the pentatonic coloring
                for learning CAGED shapes, or the major/minor roots coloring to
                quickly see where the major/minor chords are for a given key
              </li>
              <li>
                Adjust the tuning of each string using the textbox, adjust the
                number of strings in the settings menu
              </li>
              <li>
                Practice your musical ear in the Ear Training section. Select
                which type of chords you want included and random chords from
                the set will be generated for your to identify by ear
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
