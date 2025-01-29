import { Button } from '~/components/ui/button';
import { Coffee } from 'lucide-react';

export default function BuyMeCoffeeButton() {
  return (
    <Button
      className="bg-primary hover:bg-primary/90 rounded-full"
      size="icon"
      asChild
      aria-label="Buy me a coffee"
    >
      <a
        href="https://www.buymeacoffee.com/chasemc67"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Coffee className="h-5 w-5" />
      </a>
    </Button>
  );
}
