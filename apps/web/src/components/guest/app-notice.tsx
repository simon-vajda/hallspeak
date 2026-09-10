import { ExternalLink, Info } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { answerAppNotice, appListenerLink, hasAnsweredAppNotice } from '@/lib/app-notice';
import { isPhoneBrowser } from '@/lib/phone-browser';

export function AppNotice() {
  const [phone] = useState(() => isPhoneBrowser(navigator.userAgent));
  const [answered, setAnswered] = useState(hasAnsweredAppNotice);
  const [open, setOpen] = useState(() => phone && !answered);

  if (!phone) {
    return null;
  }

  const answer = (choice: 'not-now' | 'listen') => {
    answerAppNotice(choice);
    setAnswered(true);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      disablePointerDismissal
      onOpenChange={(next) => {
        if (next) {
          setOpen(true);
        } else {
          answer('not-now');
        }
      }}
    >
      {/* Reserve the chip's slot even on first visit: closing the overlay never moves
          the listening controls underneath it. */}
      <div className="flex justify-center px-gutter pt-6.5">
        <DialogTrigger
          render={<Button variant="secondary" />}
          className={`h-9.5 gap-1.75 rounded-full px-3.75 text-note font-semibold focus-visible:ring-offset-2 ${answered ? '' : 'invisible'}`}
        >
          <Info aria-hidden className="size-4" />
          About the app
        </DialogTrigger>
      </div>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-var(--spacing-gutter)*2)] max-w-100 gap-3 p-panel sm:max-w-100"
      >
        <DialogTitle className="text-section">LinguaCast has an app</DialogTitle>
        <DialogDescription>
          For smoother background listening, download the app. It also makes it easier to connect to
          the events you attend often.
        </DialogDescription>
        <div className="mt-1.5 flex flex-wrap gap-2.5">
          <Button
            variant="outline"
            size="action"
            className="focus-visible:ring-offset-2 lg:h-touch"
            onClick={() => answer('not-now')}
          >
            Not now
          </Button>
          <Button
            size="action"
            className="focus-visible:ring-offset-2 lg:h-touch"
            nativeButton={false}
            render={<a href={appListenerLink(window.location.href)} />}
            onClick={() => answer('listen')}
          >
            Listen in the app
            <ExternalLink aria-hidden className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
