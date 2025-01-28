import BuyMeCoffeeButton from '../BuyMeCoffeeButton';

export default function Footer() {
  return (
    <footer className="bg-background py-4 px-2">
      <div className="mx-auto md:mr-8 md:ml-auto">
        <div className="flex justify-center md:justify-end">
          <BuyMeCoffeeButton />
        </div>
      </div>
    </footer>
  );
}
