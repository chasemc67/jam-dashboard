import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';

export default function DesktopAnalyzer() {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string>();

  async function openAnalyzer() {
    setOpening(true);
    try {
      const result = await window.jamDesktop?.openAnalyzer();
      if (!result?.ok) {
        setError(
          result?.error ??
            'Open the installed Jam Dashboard Mac app to use the analyzer.',
        );
      }
    } catch {
      setError(
        'Could not open YouTube Music Analyzer. Try reopening Jam Dashboard.',
      );
    } finally {
      setOpening(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={openAnalyzer}
        disabled={opening}
      >
        <Download className="mr-2 h-4 w-4" />
        {opening ? 'Opening…' : 'YouTube Analyzer'}
      </Button>
      <Dialog
        open={Boolean(error)}
        onOpenChange={open => {
          if (!open) setError(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Could not open the analyzer</DialogTitle>
            <DialogDescription>{error}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
