import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

export default function Test() {
  return (
    <div className="min-h-screen bg-background dark">
      <div className="container mx-auto flex min-h-screen flex-col items-center justify-center gap-8 p-4">
        <div className="w-full max-w-sm space-y-4 rounded-lg bg-card p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-primary">Test Components</h1>
          <Input
            type="text"
            placeholder="Type something..."
            className="border-accent"
          />
          <Button className="w-full bg-primary hover:bg-primary/90">
            Click me
          </Button>
        </div>
      </div>
    </div>
  );
}
