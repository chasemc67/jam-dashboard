import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';

export default function HowToUse() {
  return (
    <div className="w-full max-w-3xl">
      <Accordion
        type="multiple"
        defaultValue={['scales', 'chordExplorer', 'earTraining']}
      >
        <AccordionItem value="scales">
          <AccordionTrigger>Understanding Guitar Scales</AccordionTrigger>
          <AccordionContent>
            <div className="prose prose-invert max-w-none space-y-6">
              <section>
                <h3 className="text-xl font-semibold mb-2">What are Scales?</h3>
                <p>
                  Scales are the foundation of music theory on guitar. A scale
                  is a sequence of notes played in ascending or descending
                  order, following specific intervals. On the guitar, the same
                  scale pattern can be played in different positions on the
                  fretboard, making it essential to visualize these patterns.
                </p>
              </section>

              <section>
                <h3 className="text-xl font-semibold mb-2">
                  Multiple Positions (CAGED System)
                </h3>
                <p>
                  For example, the C major scale (C, D, E, F, G, A, B) can be
                  played in multiple positions on the fretboard. The beauty of
                  the guitar is that due to its tuning system, you can play the
                  same scale in different positions, each offering unique
                  advantages for different musical contexts.
                </p>
                <p className="mt-2">
                  Enable the CAGED mode in settings to visualize these different
                  positions. The CAGED system is a powerful method that shows
                  you five different ways to play the same scale across the
                  fretboard, based on common chord shapes. This is why
                  visualizing the fretboard is crucial - it helps you understand
                  how scales connect across the entire neck of the guitar.
                </p>
              </section>

              <section>
                <h3 className="text-xl font-semibold mb-2">
                  Using the Visualizer
                </h3>
                <p>
                  Use the fretboard visualizer above to explore different
                  scales:
                </p>
                <ul className="list-disc pl-6 mt-2">
                  <li>Start by selecting a key</li>
                  <li>
                    Choose a scale type (by default, only major and minor scales
                    are shown)
                  </li>
                  <li>
                    Enable CAGED mode in settings to see different scale
                    positions
                  </li>
                  <li>Watch how the notes light up across the fretboard</li>
                  <li>
                    Experiment with different positions to find what works best
                    for you
                  </li>
                </ul>
                <p className="mt-4">
                  For more advanced scale exploration, you can enable additional
                  scale types in settings:
                </p>
                <ul className="list-disc pl-6 mt-2">
                  <li>Modal scales (Dorian, Phrygian, etc.)</li>
                  <li>Harmonic minor scales</li>
                  <li>Melodic minor scales</li>
                </ul>
                <p className="mt-4">
                  When working with pentatonic scales, we recommend setting the
                  Quick Colors to &quot;pentatonic&quot; in settings. This helps
                  you visualize which notes are being omitted from the major
                  scale, making it easier to understand the relationship between
                  pentatonic and major scales.
                </p>
              </section>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="chordExplorer">
          <AccordionTrigger>Exploring Chords</AccordionTrigger>
          <AccordionContent>
            <div className="prose prose-invert max-w-none space-y-6">
              <section>
                <h3 className="text-xl font-semibold mb-2">
                  What is the Chord Explorer?
                </h3>
                <p>
                  The Chord Explorer is your interactive guide to understanding
                  and discovering guitar chords. It helps you learn how chords
                  are built, what they sound like, and where to find them on
                  your guitar.
                </p>
              </section>

              <section>
                <h3 className="text-xl font-semibold mb-2">Getting Started</h3>
                <p>
                  Begin by selecting a musical key at the top of the page. This
                  key will determine which chords are naturally available to
                  you. Some chords might appear greyed out - don&apos;t worry!
                  This just means they&apos;re not commonly used in your
                  selected key.
                </p>
              </section>

              <section>
                <h3 className="text-xl font-semibold mb-2">
                  Exploring Different Chord Types
                </h3>
                <p>
                  We&apos;ve organized chords into different categories based on
                  their complexity:
                </p>
                <ul className="list-disc pl-6 mt-2">
                  <li>Start with basic chords like major and minor</li>
                  <li>Progress to 7th chords when you&apos;re ready</li>
                  <li>
                    Explore more complex variations as your understanding grows
                  </li>
                  <li>
                    Or select &quot;everything&quot; to see all possible chord
                    types at once
                  </li>
                </ul>
                <p className="mt-2">
                  This organized approach helps you build your chord vocabulary
                  gradually, without feeling overwhelmed.
                </p>
              </section>

              <section>
                <h3 className="text-xl font-semibold mb-2">
                  Interactive Learning
                </h3>
                <p>Each chord in the explorer is interactive:</p>
                <ul className="list-disc pl-6 mt-2">
                  <li>Click on any chord to hear how it sounds</li>
                  <li>
                    Watch the fretboard light up to show all possible positions
                    for that chord
                  </li>
                  <li>
                    Experiment with different voicings - any combination of the
                    highlighted notes will create your chord
                  </li>
                  <li>
                    Find your favorite voicings by trying different combinations
                    of notes
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-xl font-semibold mb-2">Pro Tips</h3>
                <p>
                  Try playing the same chord in different positions on the neck.
                  Each voicing has its own unique character and might work
                  better in different musical contexts. Don&apos;t be afraid to
                  experiment - that&apos;s how you&apos;ll develop your own
                  style!
                </p>
              </section>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="earTraining">
          <AccordionTrigger>Ear Training</AccordionTrigger>
          <AccordionContent>
            <div className="prose prose-invert max-w-none space-y-6">
              <section>
                <h3 className="text-xl font-semibold mb-2">
                  What is Ear Training?
                </h3>
                <p>
                  Ear training is a fundamental skill for any musician. Our
                  interactive game helps you develop your ability to recognize
                  musical notes and chords by ear - an essential skill for
                  playing music intuitively and learning songs without sheet
                  music.
                </p>
              </section>

              <section>
                <h3 className="text-xl font-semibold mb-2">How to Practice</h3>
                <p>For the best results, we recommend:</p>
                <ul className="list-disc pl-6 mt-2">
                  <li>Have your guitar ready while playing the game</li>
                  <li>
                    When you hear a note or chord, try to find it on your
                    fretboard before making a guess
                  </li>
                  <li>
                    Start with single notes until you&apos;re comfortable
                    identifying them
                  </li>
                  <li>
                    Gradually progress to more complex chords as your ear
                    develops
                  </li>
                  <li>
                    Practice regularly - even just 5-10 minutes a day can make a
                    big difference
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="text-xl font-semibold mb-2">
                  Learning Progression
                </h3>
                <p>
                  We recommend following this progression to build your ear
                  training skills:
                </p>
                <ul className="list-disc pl-6 mt-2">
                  <li>
                    Begin with single notes to develop basic pitch recognition
                  </li>
                  <li>Move on to basic major and minor chords</li>
                  <li>
                    Progress to seventh chords once you&apos;re comfortable with
                    triads
                  </li>
                  <li>
                    Finally, challenge yourself with more complex chord
                    variations
                  </li>
                </ul>
                <p className="mt-2">
                  Remember, the goal isn&apos;t just to win the game, but to
                  develop a skill that will make you a better musician. Take
                  your time and focus on accuracy over speed.
                </p>
              </section>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
