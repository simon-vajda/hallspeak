import { zodResolver } from '@hookform/resolvers/zod';
import { apiProblemCode, apiProblemMessage } from '@linguacast/client-core/query-retry';
import { PASSWORD_MAX_LENGTH } from '@linguacast/contract/patterns';
import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { $api } from '@/api/client';
import { PasswordChecklist } from '@/components/auth/password-checklist';
import { PasswordField } from '@/components/auth/password-field';
import { DialogActions } from '@/components/confirm-dialog';
import { MICRO_LABEL } from '@/components/micro-label';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { type ChangePasswordFormValues, changePasswordFormSchema } from '@/lib/auth-forms';

export function ChangePasswordDialog({
  open,
  onOpenChange,
  username,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-105">
        {/* A child so it unmounts with the portal: every open starts empty. */}
        <ChangePasswordForm username={username} onChanged={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordForm({ username, onChanged }: { username: string; onChanged: () => void }) {
  const usernameId = useId();
  const currentId = useId();
  const newId = useId();
  const confirmId = useId();
  const change = $api.useMutation('post', '/admin/password');
  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    resetField,
    formState: { errors, isValid, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmation: '' },
    mode: 'onChange',
  });
  const newPassword = useWatch({ control, name: 'newPassword' });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword: submitted }) => {
    clearErrors('root.server');
    try {
      await change.mutateAsync({ body: { currentPassword, newPassword: submitted } });
      toast.success('Password changed. Other devices were signed out.');
      onChanged();
    } catch (error) {
      if (apiProblemCode(error) === 'invalid_credentials') {
        resetField('currentPassword');
        setError('currentPassword', { message: 'That is not your current password.' });
        return;
      }
      setError('root.server', {
        message: apiProblemMessage(error) ?? 'The password was not changed. Try again.',
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <DialogTitle className="mb-1.5">Change password</DialogTitle>
      <DialogDescription className="mb-5">
        Every other device signed in as the administrator will be signed out.
      </DialogDescription>

      <div className="flex flex-col gap-3.5">
        <Field className="gap-1.5">
          <FieldLabel htmlFor={usernameId} className={MICRO_LABEL}>
            Username
          </FieldLabel>
          {/* An input rather than plain text, so a password manager saves the new password
              against this account. Out of the tab order, so the dialog opens on the first
              field that takes typing. */}
          <Input
            id={usernameId}
            autoComplete="username"
            value={username}
            readOnly
            tabIndex={-1}
            className="border-border bg-transparent text-muted-foreground dark:bg-transparent"
          />
        </Field>

        <Field className="gap-1.5">
          <FieldLabel htmlFor={currentId} className={MICRO_LABEL}>
            Current password
          </FieldLabel>
          <PasswordField
            id={currentId}
            autoComplete="current-password"
            maxLength={PASSWORD_MAX_LENGTH}
            aria-invalid={errors.currentPassword ? true : undefined}
            {...register('currentPassword')}
          />
          <FieldError errors={[errors.currentPassword]} />
        </Field>

        <Field className="gap-1.5">
          <FieldLabel htmlFor={newId} className={MICRO_LABEL}>
            New password
          </FieldLabel>
          <PasswordField
            id={newId}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX_LENGTH}
            aria-invalid={errors.newPassword ? true : undefined}
            {...register('newPassword')}
          />
          <PasswordChecklist password={newPassword} />
        </Field>

        <Field className="gap-1.5">
          <FieldLabel htmlFor={confirmId} className={MICRO_LABEL}>
            Confirm new password
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
      </div>

      <FieldError errors={[errors.root?.server]} className="mt-4" />

      <DialogActions>
        <DialogClose render={<Button variant="outline" size="action" />}>Cancel</DialogClose>
        {/* setError forces isValid false, and the fields already passed validation when the
            server refused, so a server error alone must not lock the retry. */}
        <Button
          type="submit"
          size="action"
          disabled={isSubmitting || (!isValid && !errors.root?.server)}
        >
          Change password
        </Button>
      </DialogActions>
    </form>
  );
}
