import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useId, useRef, useState } from 'react';
import { $api } from '@/api/client';
import { AuthCard } from '@/components/auth/auth-card';
import { PasswordField } from '@/components/auth/password-field';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { internalPath, sessionKey, sessionQueryOptions } from '@/lib/auth-queries';

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const target = internalPath(search.redirect);
    return target ? { redirect: target } : {};
  },
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions());
    if (!session.configured) throw redirect({ to: '/setup' });
  },
  component: LoginPage,
});

const LABEL = 'text-label text-muted-foreground uppercase';
const TEXT_FIELD =
  'h-13 rounded-full border-2 border-transparent bg-secondary px-5 text-base focus-visible:border-primary focus-visible:bg-card focus-visible:ring-0';

/** Saying which half was wrong tells an unwanted visitor half the answer. */
const REFUSED = 'Username or password is incorrect.';

/** Three tries is where a typo stops being the likely explanation. */
const CLEAR_PASSWORD_AFTER = 3;

function LoginPage() {
  const { redirect: target } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const usernameId = useId();
  const passwordId = useId();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string>();
  const failures = useRef(0);

  const login = $api.useMutation('post', '/auth/login', {
    // Seeded rather than invalidated, for the reason setup.tsx states: `ensureQueryData`
    // returns the stale entry while a refetch is in flight, and the stale entry says
    // signed out.
    onSuccess: async (session) => {
      failures.current = 0;
      queryClient.setQueryData(sessionKey(), session);
      // `href` rather than `to`: the attempted path is a string the guard put in the URL,
      // already narrowed to an internal router path, and there is no route literal for it.
      if (target) await navigate({ href: target });
      else await navigate({ to: '/admin/events' });
    },
    onError: (error, _variables, _context) => {
      failures.current += 1;
      // The generic message for a refusal, and the server's own words for anything else —
      // being throttled or unreachable is not a wrong password and must not read as one.
      const problem = error as { code?: string; message?: string };
      setMessage(problem.code === 'invalid_credentials' ? REFUSED : (problem.message ?? REFUSED));
      // Both fields keep their value until then; only the password is cleared.
      if (failures.current >= CLEAR_PASSWORD_AFTER) setPassword('');
    },
  });

  return (
    <AuthCard className="lg:max-w-110">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (username && password) login.mutate({ body: { username, password } });
        }}
        className="flex flex-col"
      >
        <h1 className="mb-2 text-section">Sign in</h1>
        <p className="mb-7 text-sm leading-normal text-muted-foreground">
          Administrator access. Joining an event does not need an account.
        </p>

        <Field className="mb-5 gap-2">
          <FieldLabel htmlFor={usernameId} className={LABEL}>
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
            aria-invalid={message !== undefined}
            className={TEXT_FIELD}
          />
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor={passwordId} className={LABEL}>
            Password
          </FieldLabel>
          <PasswordField
            id={passwordId}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="Password"
            aria-invalid={message !== undefined}
          />
        </Field>

        {/* One message under the pair, never on either field. */}
        {message && (
          <p role="alert" className="mt-3.5 text-sm text-destructive">
            {message}
          </p>
        )}

        <Button
          type="submit"
          size="pill"
          disabled={login.isPending}
          className="mt-7 w-full lg:w-fit"
        >
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}
