import { MessageCircle } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { useState } from 'react';
import { Textarea } from '~/components/ui/textarea';
import posthog from 'posthog-js';

export default function FeedbackSurvey() {
  const [feedback, setFeedback] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      await posthog.capture('survey_responded', {
        $survey_id: '0194af0c-102d-0000-edc8-947d9e250a07',
        $survey_response: feedback,
        $survey_name: 'Open feedback',
        response: feedback,
      });
      setFeedback('');
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          aria-label="Open feedback form"
        >
          <MessageCircle className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <h4 className="font-medium leading-none">Share Your Feedback</h4>
          <p className="text-sm text-muted-foreground">
            Help us improve by sharing your thoughts!
          </p>
          <Textarea
            placeholder="What's on your mind?"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            className="min-h-[100px]"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={!feedback.trim() || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
