import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PROMISES = [
  'Create events and language channels',
  'Hand out speaker links and guest PINs',
  'Watch who is on air',
];

export function SetupWelcome({ onContinue }: { onContinue: () => void }) {
  return (
    <>
      <h1 className="mb-2.5 text-section">This server has no account yet</h1>
      <p className="mb-6 text-sm leading-normal text-muted-foreground">
        Create the administrator account to finish installing LinguaCast. It is the only account on
        this server — speakers and guests join an event with a link or a PIN and never sign in.
      </p>

      <ul className="mb-8 flex flex-col gap-2.5">
        {PROMISES.map((promise) => (
          <li key={promise} className="flex items-center gap-2.5 text-sm">
            <Check className="size-4 shrink-0 text-primary" strokeWidth={3} />
            {promise}
          </li>
        ))}
      </ul>

      <Button type="button" size="pill" onClick={onContinue} className="w-full lg:w-fit">
        Create admin account
      </Button>
      <p className="mt-4 text-note text-muted-foreground">
        Anyone who can reach this address on your network can complete this step, so do it now.
      </p>
    </>
  );
}
