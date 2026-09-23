import BuyMeCoffeeButton from '../BuyMeCoffeeButton';
import FeedbackSurvey from '../FeedbackSurvey';
import AgentChat from '../AgentChat';
import AiGuide from '../AiGuide';

export default function Footer() {
  return (
    <footer className="bg-background py-4 px-2">
      <AiGuide />
      <AgentChat />
      <div className="mx-auto md:mr-8 md:ml-auto">
        <div className="flex justify-center md:justify-end gap-2">
          {!(import.meta.env.JAM_DESKTOP || import.meta.env.JAM_AGENT) && (
            <FeedbackSurvey />
          )}
          <BuyMeCoffeeButton />
        </div>
      </div>
    </footer>
  );
}
