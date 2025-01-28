import BuyMeCoffeeButton from '../BuyMeCoffeeButton';
import FeedbackSurvey from '../FeedbackSurvey';

export default function Footer() {
  return (
    <footer className="bg-background py-4 px-2">
      <div className="mx-auto md:mr-8 md:ml-auto">
        <div className="flex justify-center md:justify-end gap-2">
          <FeedbackSurvey />
          <BuyMeCoffeeButton />
        </div>
      </div>
    </footer>
  );
}
