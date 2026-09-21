import { apiProblemMessage } from '@hallspeak/client-core/query-retry';
import { PASSWORD_MAX_LENGTH } from '@hallspeak/contract/patterns';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { $api } from '@/api/client';
import { PasswordChecklist } from '@/components/auth/password-checklist';
import { PasswordField } from '@/components/auth/password-field';
import { MICRO_LABEL } from '@/components/micro-label';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { type SetupFormValues, setupFormSchema } from '@/lib/auth-forms';
import { sessionKey } from '@/lib/auth-queries';

export function SetupCredentialsForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const usernameId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const setup = $api.useMutation('post', '/auth/setup');
  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isValid, isSubmitting },
  } = useForm<SetupFormValues>({
    resolver: zodResolver(setupFormSchema),
    defaultValues: { username: '', password: '', confirmation: '' },
    mode: 'onChange',
  });
  const password = useWatch({ control, name: 'password' });

  const onSubmit = handleSubmit(async ({ username, password: submittedPassword }) => {
    clearErrors('root.server');
    try {
      const session = await setup.mutateAsync({ body: { username, password: submittedPassword } });
      queryClient.setQueryData(sessionKey(), session);
      await navigate({ to: '/admin/events' });
    } catch (error) {
      setError('root.server', {
        message: apiProblemMessage(error) ?? 'That did not work. Try again.',
      });
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col" noValidate>
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
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="admin"
          aria-invalid={errors.username ? true : undefined}
          {...register('username')}
        />
        <FieldError errors={[errors.username]} />
      </Field>

      <Field className="mb-5 gap-2">
        <FieldLabel htmlFor={passwordId} className={MICRO_LABEL}>
          Password
        </FieldLabel>
        <PasswordField
          id={passwordId}
          autoComplete="new-password"
          maxLength={PASSWORD_MAX_LENGTH}
          aria-invalid={errors.password ? true : undefined}
          {...register('password')}
        />
        <PasswordChecklist password={password} />
      </Field>

      <Field className="mb-7 gap-2">
        <FieldLabel htmlFor={confirmId} className={MICRO_LABEL}>
          Confirm password
        </FieldLabel>
        <PasswordField
          id={confirmId}
          autoComplete="new-password"
          maxLength={PASSWORD_MAX_LENGTH}
          placeholder="Repeat it"
          aria-invalid={errors.confirmation ? true : undefined}
          {...register('confirmation')}
        />
        <FieldError errors={[errors.confirmation]} />
      </Field>

      <FieldError errors={[errors.root?.server]} className="mb-4" />

      <Button type="submit" size="pill" disabled={!isValid || isSubmitting} className="w-full">
        Finish setup
      </Button>
      <p className="mt-4 text-note text-muted-foreground">
        Keep this somewhere safe. You can change it after signing in; a forgotten password needs
        access to the machine LinguaCast runs on.
      </p>
    </form>
  );
}
