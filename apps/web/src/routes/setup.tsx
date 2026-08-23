import { PASSWORD_MAX_LENGTH } from '@linguacast/contract/patterns';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Check } from 'lucide-react';
import { useId, useState } from 'react';
import { $api } from '@/api/client';
import { AuthCard } from '@/components/auth/auth-card';
import { PasswordChecklist } from '@/components/auth/password-checklist';
import { PasswordField } from '@/components/auth/password-field';
import { MICRO_LABEL } from '@/components/micro-label';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { sessionKey, sessionQueryOptions } from '@/lib/auth-queries';
import { canFinishSetup } from '@/lib/password-rules';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/setup')({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions());
    // The wizard is unreachable once an account exists; it cannot create a second one.
    if (session.configured) {
      throw redirect({ to: '/login' });
    }
  },
  component: SetupPage,
});

const PROMISES = [
  'Create events and language channels',
  'Hand out speaker links and guest PINs',
  'Watch who is on air',
];

function SetupPage() {
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <AuthCard className="lg:max-w-130">
      <StepPips step={step} />
      {step === 1 ? <Welcome onContinue={() => setStep(2)} /> : <Credentials />}
    </AuthCard>
  );
}

function StepPips({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <div className="h-1 w-5.5 rounded-full bg-primary" />
      <div className={cn('h-1 w-5.5 rounded-full', step === 2 ? 'bg-primary' : 'bg-border')} />
      <span className={cn(MICRO_LABEL, 'ml-1')}>Step {step} of 2</span>
    </div>
  );
}

function Welcome({ onContinue }: { onContinue: () => void }) {
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

function Credentials() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const usernameId = useId();
  const passwordId = useId();
  const confirmId = useId();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const setup = $api.useMutation('post', '/auth/setup', {
    // Seeded from the response rather than invalidated: the admin guard reads this entry
    // through `ensureQueryData`, which hands back the stale value while a refetch is still
    // in flight — and the stale value here says the server has no account.
    onSuccess: async (session) => {
      queryClient.setQueryData(sessionKey(), session);
      await navigate({ to: '/admin/events' });
    },
  });

  const ready = username.length > 0 && canFinishSetup(password, confirmation);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) {
          setup.mutate({ body: { username, password } });
        }
      }}
      className="flex flex-col"
    >
      <h1 className="mb-2.5 text-section">Choose your credentials</h1>
      <p className="mb-7 text-sm leading-normal text-muted-foreground">
        You will use these to sign in from any device on the network.
      </p>

      <Field className="mb-5 gap-2">
        <FieldLabel htmlFor={usernameId} className={MICRO_LABEL}>
          Username
        </FieldLabel>
        <Input
          id={usernameId}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="admin"
        />
      </Field>

      <Field className="mb-5 gap-2">
        <FieldLabel htmlFor={passwordId} className={MICRO_LABEL}>
          Password
        </FieldLabel>
        <PasswordField
          id={passwordId}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          maxLength={PASSWORD_MAX_LENGTH}
        />
        <PasswordChecklist password={password} />
      </Field>

      <Field className="mb-7 gap-2">
        <FieldLabel htmlFor={confirmId} className={MICRO_LABEL}>
          Confirm password
        </FieldLabel>
        <PasswordField
          id={confirmId}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="new-password"
          maxLength={PASSWORD_MAX_LENGTH}
          placeholder="Repeat it"
        />
      </Field>

      {setup.isError && (
        <p className="mb-4 text-sm text-destructive">
          {setup.error.message || 'That did not work. Try again.'}
        </p>
      )}

      <Button type="submit" size="pill" disabled={!ready || setup.isPending} className="w-full">
        Finish setup
      </Button>
      <p className="mt-4 text-note text-muted-foreground">
        Keep this somewhere safe. Changing it later needs access to the machine LinguaCast runs on.
      </p>
    </form>
  );
}
