import BuyMeCoffeeButton from '../BuyMeCoffeeButton';

export default function Footer() {
  return (
    <footer className="bg-background p-4">
      <div className="container mx-auto">
        <div className="flex justify-center md:justify-start">
          <BuyMeCoffeeButton />
        </div>
      </div>
    </footer>
  );
}
