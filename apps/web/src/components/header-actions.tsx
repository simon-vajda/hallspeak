import { EllipsisVertical, QrCode } from 'lucide-react';
import { useRef, useState } from 'react';
import { type ShareEvent, ShareEventDialog } from '@/components/share-event-dialog';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
import { ThemeMenuItem } from '@/components/theme-menu-item';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Both triggers open one dialog. They are toggled by CSS, so the hidden one is `display:
 * none` and out of the tab order; the dialog returns focus to whichever opened it.
 */
export function HeaderActions({ share }: { share: ShareEvent }) {
  const [open, setOpen] = useState(false);
  const shareButton = useRef<HTMLButtonElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const openFrom = (trigger: HTMLElement | null) => {
    returnFocus.current = trigger;
    setOpen(true);
  };

  return (
    <>
      <div className="hidden items-center gap-1 lg:flex">
        <Button
          ref={shareButton}
          variant="ghost"
          size="icon"
          onClick={() => openFrom(shareButton.current)}
        >
          <QrCode />
          <span className="sr-only">Share event</span>
        </Button>
        <TempThemeToggle />
      </div>

      <div className="lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger ref={menuTrigger} render={<Button variant="ghost" size="icon" />}>
            <EllipsisVertical />
            <span className="sr-only">More options</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-48">
            <DropdownMenuItem onClick={() => openFrom(menuTrigger.current)}>
              <QrCode />
              Share event
            </DropdownMenuItem>
            <ThemeMenuItem />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ShareEventDialog
        share={share}
        open={open}
        onOpenChange={setOpen}
        returnFocus={returnFocus}
      />
    </>
  );
}
