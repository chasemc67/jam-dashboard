import { Button } from '~/components/ui/button';

export default function BuyMeCoffeeButton() {
  return (
    <Button className="bg-primary hover:bg-primary/90" asChild>
      <a
        href="https://www.buymeacoffee.com/chasemc67"
        target="_blank"
        rel="noopener noreferrer"
      >
        ☕️ Buy me a coffee
      </a>
    </Button>
  );
}
