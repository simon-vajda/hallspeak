import { Info } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { isPhoneBrowser } from '@/lib/phone-browser';
import { screenAwakeLabel, screenAwakeNote } from '@/lib/screen-awake-copy';
import type { ScreenWakeLockStatus } from '@/lib/use-screen-wake-lock';

export function ScreenAwakeNotice({
  status,
  className,
}: {
  status: ScreenWakeLockStatus;
  className?: string;
}) {
  const [phone] = useState(() => isPhoneBrowser(navigator.userAgent));
  const [open, setOpen] = useState(false);

  if (!phone) {
    return null;
  }

  const note = screenAwakeNote(status);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className={`flex justify-center ${className ?? ''}`}>
        <DialogTrigger
          render={<Button variant="secondary" />}
          className="h-9.5 gap-1.75 rounded-full px-3.75 text-note font-semibold focus-visible:ring-offset-2"
        >
          <Info aria-hidden className="size-4" />
          {screenAwakeLabel(status)}
        </DialogTrigger>
      </div>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-var(--spacing-gutter)*2)] max-w-100 gap-3 p-panel sm:max-w-100"
      >
        <DialogTitle className="text-section">Keep the screen awake</DialogTitle>
        <DialogDescription>
          A phone takes the microphone away as soon as the browser goes to the background or the
          screen locks. Leave this page in the foreground and the phone unlocked for the whole
          broadcast.
          {note ? ` ${note}` : ''}
        </DialogDescription>
        <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">
          <DialogClose render={<Button size="action" />} className="focus-visible:ring-offset-2">
            Got it
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
