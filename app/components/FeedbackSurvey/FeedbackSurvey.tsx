import { MessageCircle } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { useState } from 'react';
import { Textarea } from '~/components/ui/textarea';
import { Input } from '~/components/ui/input';
import posthog from 'posthog-js';

export default function FeedbackSurvey() {
  const [feedback, setFeedback] = useState('');
  const [email, setEmail] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      const formattedFeedback = email
        ? `${feedback}\n\nContact email: ${email}`
        : feedback;

      await posthog.capture('survey_responded', {
        $survey_id: '0194af0c-102d-0000-edc8-947d9e250a07',
        $survey_response: formattedFeedback,
        $survey_name: 'Open feedback',
        response: formattedFeedback,
        email: email,
      });
      setFeedback('');
      setEmail('');
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
            Help me make Jam Dashboard even better!
          </p>
          <Textarea
            placeholder="What's on your mind?"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            className="min-h-[100px]"
          />
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Leave your email if you want to hear back
            </p>
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
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
