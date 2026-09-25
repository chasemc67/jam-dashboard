import { lazy, Suspense, useId, useState } from 'react';
import { Close as PopoverClose } from '@radix-ui/react-popover';
import {
  Eye,
  Guitar,
  Headphones,
  Layers,
  MapPin,
  Music2,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';

const AdvancedMcpGuide = lazy(() => import('../AdvancedMcpGuide'));

const capabilities = [
  {
    title: 'Find a song’s key & tempo',
    icon: Headphones,
    description:
      'Connect to the desktop app to search YouTube by song and artist, or analyze a direct YouTube link. The app downloads an MP3 and estimates the key, BPM, and confidence. Ask your assistant to check progress or cancel.',
    examples: [
      'What key and BPM is Blue Skies by Ella Fitzgerald?',
      'Analyze this YouTube URL, then show me its key on the fretboard.',
    ],
  },
  {
    title: 'Keys & scales',
    icon: Music2,
    description:
      'Choose a key or scale and see it on the fretboard. Ask for its notes and intervals, too.',
    examples: ['Show B major.', 'What notes are in D Dorian?'],
  },
  {
    title: 'Understand chords',
    icon: Guitar,
    description:
      'Identify a chord from notes, or look up its tones and intervals. The first note is treated as the bass; more than one chord name may fit.',
    examples: ['What chord is E, G, C, with E in the bass?'],
  },
  {
    title: 'Highlight notes & positions',
    icon: MapPin,
    description:
      'Show chord tones, individual notes, or exact string and fret positions. Clear the highlights to return to the full scale.',
    examples: [
      'In C major, highlight C, E and G.',
      'Show C on string 2, fret 1.',
    ],
  },
  {
    title: 'Find chord voicings',
    icon: Layers,
    description:
      'Find ways to play a chord and browse them on the board. Ask for a fret range, a smaller stretch, or a particular bass note.',
    examples: ['In C major, show four C/E voicings, then show the second one.'],
  },
  {
    title: 'CAGED & fretboard settings',
    icon: SlidersHorizontal,
    description:
      'Explore CAGED pentatonic coloring. Change tuning, string count, frets, handedness, note labels, and scale or root colors.',
    examples: [
      'Show the C CAGED pattern in G major.',
      'Use a left-handed fretboard with 15 frets.',
    ],
  },
  {
    title: 'Work with your current view',
    icon: Eye,
    description:
      'Read the selected scale, tuning, highlights, and voicing. Find connected windows and check which features are available.',
    examples: ['What scale and tuning am I using?'],
  },
];

export default function AiGuide({
  defaultOpen = false,
  defaultMode = 'guide',
}: {
  defaultOpen?: boolean;
  defaultMode?: 'guide' | 'advanced';
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [mode, setMode] = useState(defaultMode);
  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-40">
      <Popover defaultOpen={defaultOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button
            size="icon"
            className="h-11 w-11 rounded-full text-sm font-semibold shadow-lg"
            aria-label="Explore AI capabilities"
            title="Explore AI capabilities"
          >
            AI
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={12}
          collisionPadding={16}
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          className={`flex max-h-[min(38rem,var(--radix-popover-content-available-height))] flex-col overflow-hidden rounded-xl p-0 shadow-xl [@media(max-height:500px)]:block [@media(max-height:500px)]:overflow-y-auto ${mode === 'advanced' ? 'w-[min(36rem,calc(100vw-2rem))]' : 'w-[min(25rem,calc(100vw-2rem))]'}`}
        >
          <Tabs
            value={mode}
            onValueChange={value =>
              setMode(value === 'advanced' ? 'advanced' : 'guide')
            }
            className="flex min-h-0 flex-1 flex-col [@media(max-height:500px)]:block"
          >
            <div className="shrink-0 border-b px-5 pb-4 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    MCP guide
                  </div>
                  <h2 id={titleId} className="text-lg font-semibold">
                    {mode === 'guide' ? 'Explore with AI' : 'MCP reference'}
                  </h2>
                </div>
                <PopoverClose asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="-mr-2 -mt-2 shrink-0 rounded-full"
                    aria-label="Close AI guide"
                  >
                    <X aria-hidden="true" />
                  </Button>
                </PopoverClose>
              </div>
              <p
                id={descriptionId}
                className="mt-2 text-sm text-muted-foreground"
              >
                {mode === 'guide' ? (
                  <>
                    Ask your connected AI assistant to analyze songs, explain
                    music, or change this fretboard. Try these prompts in Codex,
                    Cursor, or another MCP client.
                  </>
                ) : (
                  <>
                    Inspect the functions, descriptions, and schemas exposed to
                    your agent by this app build.
                  </>
                )}
              </p>
              <TabsList
                aria-label="MCP guide mode"
                className="mt-4 grid w-full grid-cols-2"
              >
                <TabsTrigger value="guide">Guide</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent
              value="guide"
              aria-label="AI capabilities and example prompts"
              className="m-0 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring [@media(max-height:500px)]:overflow-visible"
            >
              <div className="space-y-5">
                {capabilities.map(
                  ({ title, icon: Icon, description, examples }) => (
                    <section key={title}>
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <Icon
                          className="h-4 w-4 text-primary"
                          aria-hidden="true"
                        />
                        {title}
                      </h3>
                      <p className="mb-2 mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {description}
                      </p>
                      <ul className="space-y-1.5 text-sm">
                        {examples.map(example => (
                          <li
                            key={example}
                            className="rounded-md bg-muted/60 px-3 py-2"
                          >
                            “{example}”
                          </li>
                        ))}
                      </ul>
                    </section>
                  ),
                )}
              </div>
              <section className="mt-5 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
                <h3 className="mb-2 font-semibold text-foreground">
                  A few things to know
                </h3>
                <ul className="list-disc space-y-2 pl-4">
                  <li>
                    Displayed notes must belong to the selected scale. Your
                    assistant can select a compatible scale first.
                  </li>
                  <li>
                    Voicings use six-string standard tuning and return up to 20
                    matches per search. Results are a starting selection of
                    shapes; they are not ranked for ease of playing.
                  </li>
                  <li>
                    CAGED highlights pentatonic patterns rather than specific
                    chord grips.
                  </li>
                  <li>
                    Song analysis needs the desktop MCP connection and uses the
                    first YouTube match. Paste a direct URL for an exact
                    recording. One song can run at a time; its key is applied
                    only when you ask.
                  </li>
                  <li>
                    Playback, ear training, and note detection use the app
                    controls and are not exposed through MCP.
                  </li>
                </ul>
              </section>
            </TabsContent>
            <TabsContent
              value="advanced"
              aria-label="Technical MCP reference"
              className="m-0 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring [@media(max-height:500px)]:overflow-visible"
            >
              {mode === 'advanced' && (
                <Suspense
                  fallback={
                    <p role="status" className="text-sm text-muted-foreground">
                      Loading MCP reference…
                    </p>
                  }
                >
                  <AdvancedMcpGuide />
                </Suspense>
              )}
            </TabsContent>
            <div className="shrink-0 border-t bg-muted/30 px-5 py-3 text-xs leading-relaxed text-muted-foreground">
              {import.meta.env.JAM_DESKTOP || import.meta.env.JAM_AGENT ? (
                <p>
                  To connect your assistant, open{' '}
                  <span className="font-medium text-foreground">
                    Agent chat
                  </span>{' '}
                  and choose{' '}
                  <span className="font-medium text-foreground">
                    MCP connection
                  </span>{' '}
                  for the address and token.
                </p>
              ) : (
                <p>
                  MCP is available in the desktop app or a locally running
                  Chrome session. Connect your assistant from Agent chat’s MCP
                  connection panel.
                </p>
              )}
            </div>
          </Tabs>
        </PopoverContent>
      </Popover>
    </div>
  );
}
