import { CircleHelp } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';

// Use this to determine whether to show popup for first visit
// store actual date rather than just boolean so we can show new feature updates
const LAST_VISIT_KEY = 'jam-dashboard-lastVisitDate';

const isSameDay = (date1: Date, date2: Date) => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

export default function About() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
    const today = new Date();

    if (!lastVisit) {
      // First visit ever
      setIsOpen(true);
      localStorage.setItem(LAST_VISIT_KEY, today.toISOString());
    } else {
      // Check if last visit was on a different day
      const lastVisitDate = new Date(lastVisit);
      if (!isSameDay(lastVisitDate, today)) {
        localStorage.setItem(LAST_VISIT_KEY, today.toISOString());
      }
    }
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="About"
        >
          <CircleHelp className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] md:max-w-[750px] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>About</DialogTitle>
          <DialogDescription>
            Jam Dashboard is a compact tool for practicing advanced guitar
            concepts.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 overflow-y-auto">
          <div className="aspect-video w-full">
            <iframe
              className="w-full h-full rounded-lg"
              src="https://www.youtube.com/embed/p4JH-LFFVDo"
              title="Jam Dashboard Tutorial"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
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
                The Chord Explorer section lets you easily hear different chords
                in a key. Use this to help learn the difference between chords,
                or quickly play with different chord progression ideas
              </li>
              <li>
                Ear training helps you practice your musical ear. Select which
                type of chords you want included and random chords from the set
                will be generated for your to identify by ear
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
