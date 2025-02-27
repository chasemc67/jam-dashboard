import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';

export default function HowToUse() {
  return (
    <div className="w-full max-w-3xl">
      <Accordion type="single" defaultValue="scales" collapsible>
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
                  <li>Choose a scale type</li>
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
              </section>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
