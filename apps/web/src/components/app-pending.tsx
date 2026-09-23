import { Loader2 } from 'lucide-react';
import { LogoLockup } from '@/components/logo-lockup';

export function AppPending() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background">
      <LogoLockup />
      <Loader2
        aria-hidden
        className="size-6 animate-spin text-muted-foreground motion-reduce:animate-none"
      />
      <p role="status" className="sr-only">
        Loading
      </p>
    </div>
  );
}
