import { zodResolver } from '@hookform/resolvers/zod';
import { PASSWORD_MAX_LENGTH } from '@linguacast/contract/patterns';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useId, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { $api } from '@/api/client';
import { AuthCard } from '@/components/auth/auth-card';
import { PasswordField } from '@/components/auth/password-field';
import { MICRO_LABEL } from '@/components/micro-label';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { type LoginFormValues, loginFormSchema } from '@/lib/auth-forms';
import { internalPath, sessionKey, sessionQueryOptions } from '@/lib/auth-queries';
import { apiProblemCode, apiProblemMessage } from '@/lib/query-retry';

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const target = internalPath(search.redirect);
    return target ? { redirect: target } : {};
  },
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions());
    if (!session.configured) {
      throw redirect({ to: '/setup' });
    }
  },
  component: LoginPage,
});

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
  const failures = useRef(0);
  const login = $api.useMutation('post', '/auth/login');
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    resetField,
    formState: { errors, isValid, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { username: '', password: '' },
    mode: 'onChange',
  });
  const usernameField = register('username');
  const passwordField = register('password');
  const serverMessage = errors.root?.server?.message;

  const onSubmit = handleSubmit(async (values) => {
    clearErrors('root.server');
    try {
      const session = await login.mutateAsync({ body: values });
      failures.current = 0;
      queryClient.setQueryData(sessionKey(), session);
      // The attempted path is already narrowed to an internal router path by validateSearch.
      if (target) {
        await navigate({ href: target });
      } else {
        await navigate({ to: '/admin/events' });
      }
    } catch (error) {
      failures.current += 1;
      setError('root.server', {
        message:
          apiProblemCode(error) === 'invalid_credentials'
            ? REFUSED
            : (apiProblemMessage(error) ?? REFUSED),
      });
      if (failures.current >= CLEAR_PASSWORD_AFTER) {
        resetField('password');
      }
    }
  });

  const clearServerError = () => clearErrors('root.server');

  return (
    <AuthCard className="lg:max-w-110">
      <form onSubmit={onSubmit} className="flex flex-col" noValidate>
        <h1 className="mb-2 text-section">Sign in</h1>
        <p className="mb-7 text-sm leading-normal text-muted-foreground">
          Administrator access. Joining an event does not need an account.
        </p>

        <Field className="mb-5 gap-2">
          <FieldLabel htmlFor={usernameId} className={MICRO_LABEL}>
            Username
          </FieldLabel>
          <Input
            id={usernameId}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="admin"
            aria-invalid={errors.username || serverMessage ? true : undefined}
            {...usernameField}
            onChange={(event) => {
              clearServerError();
              usernameField.onChange(event);
            }}
          />
        </Field>

        <Field className="gap-2">
          <FieldLabel htmlFor={passwordId} className={MICRO_LABEL}>
            Password
          </FieldLabel>
          <PasswordField
            id={passwordId}
            autoComplete="current-password"
            maxLength={PASSWORD_MAX_LENGTH}
            placeholder="Password"
            aria-invalid={errors.password || serverMessage ? true : undefined}
            {...passwordField}
            onChange={(event) => {
              clearServerError();
              passwordField.onChange(event);
            }}
          />
        </Field>

        <FieldError errors={[errors.root?.server]} className="mt-3.5" />

        <Button
          type="submit"
          size="pill"
          disabled={!isValid || isSubmitting}
          className="mt-7 w-full lg:w-fit"
        >
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}
