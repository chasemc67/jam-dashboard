import type { MetaFunction } from '@remix-run/node';
import { KeyPicker } from '~/components/KeyPicker/KeyPicker';
import FretboardControls from '~/components/FretboardControls';
import RandomPlayer from '~/components/RandomPlayer';
export const meta: MetaFunction = () => {
  return [
    { title: 'Jam Dashboard - Guitar Learning Tools' },
    {
      name: 'description',
      content:
        'Interactive tools for learning guitar, including fretboard visualization and ear training.',
    },
  ];
};

export default function Index() {
  return (
    <div className="min-h-screen bg-background dark">
      <div className="container mx-auto flex min-h-screen flex-col items-center justify-center gap-8 p-4">
        {/* <div className="w-full max-w-sm space-y-4 rounded-lg bg-card p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-primary-foreground">
            Jam Dashboard
          </h1>
          <KeyPicker />
        </div> */}
        <FretboardControls />
        <RandomPlayer />
      </div>
    </div>
  );
}
