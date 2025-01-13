import type { MetaFunction } from '@remix-run/node';
import FretboardControls from '~/components/FretboardControls';
import RandomPlayer from '~/components/RandomPlayer';
import Header from '~/components/Header';

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
    <div className="flex min-h-screen flex-col bg-background dark">
      <Header />
      <div className="container mx-auto flex flex-1 flex-col items-center justify-center gap-8 p-4">
        <FretboardControls />
        <RandomPlayer />
      </div>
    </div>
  );
}
