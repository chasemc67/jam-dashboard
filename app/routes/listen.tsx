import type { MetaFunction } from '@remix-run/node';
import Header from '~/components/Header';
import Footer from '~/components/Footer';
import NoteDetector from '~/components/NoteDetector';

export const meta: MetaFunction = () => {
  return [
    { title: 'Listen - Jam Dashboard' },
    {
      name: 'description',
      content:
        'Detect notes from your guitar in real time using your audio interface.',
    },
  ];
};

export default function Listen() {
  return (
    <div className="flex min-h-screen flex-col bg-background dark">
      <Header />
      <div className="container mx-auto flex flex-1 flex-col items-center gap-8 p-4 pt-8 pb-20 md:pb-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">
            Live Note Detection
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your guitar via an audio interface and play notes to detect
            them in real time.
          </p>
        </div>
        <NoteDetector />
      </div>
      <Footer />
    </div>
  );
}
