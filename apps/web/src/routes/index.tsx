import { zodResolver } from '@hookform/resolvers/zod';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { Controller, useForm } from 'react-hook-form';
import { LogoLockup } from '@/components/logo-lockup';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { VersionFooter } from '@/components/version-footer';
import { sessionQueryOptions } from '@/lib/auth-queries';
import { type PinFormValues, pinFormSchema } from '@/lib/pin-form';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/')({
  // The site root, and only it: a listener or speaker link keeps working while the server
  // is unconfigured, so a printed QR code survives a recovery.
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions());
    if (!session.configured) {
      throw redirect({ to: '/setup' });
    }
  },
  component: IndexPage,
});

const PIN_LENGTH = 6;

// The design draws separated boxes; shadcn's default slot is one joined group, so most of this
// is unpicking that. `[&>div>div]` is input-otp's fake caret, which no prop reaches.
const SLOT_CLASS = cn(
  'h-14 w-full rounded-md border-2 border-transparent bg-secondary text-pin',
  'font-semibold text-foreground transition-colors dark:bg-secondary',
  'first:rounded-md first:border-2 last:rounded-md',
  // The dark: pair is repeated on the active state so it outranks dark:bg-secondary above.
  'data-[active=true]:border-primary data-[active=true]:ring-0',
  'data-[active=true]:bg-primary/10 dark:data-[active=true]:bg-primary/10',
  '[&>div>div]:h-5.5 [&>div>div]:w-0.5 [&>div>div]:bg-primary',
  // rounded-md, not rounded-2xl: this scale is derived from --radius (20px), so the
  // design's 16px box is 0.8 × radius, and rounded-2xl would be 36px.
  'lg:h-18.5 lg:w-15.5 lg:text-pin-lg',
  'lg:[&>div>div]:h-7',
);

function IndexPage() {
  const navigate = useNavigate();
  const { control, handleSubmit, watch } = useForm<PinFormValues>({
    resolver: zodResolver(pinFormSchema),
    defaultValues: { pin: '' },
    mode: 'onSubmit',
  });

  const isComplete = watch('pin').length === PIN_LENGTH;

  const onSubmit = handleSubmit(({ pin }) => {
    navigate({ to: '/events/$pin', params: { pin } });
  });

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="absolute top-3.5 right-gutter z-10 lg:top-4 lg:right-10">
        <TempThemeToggle />
      </div>

      <header className="hidden border-b border-border px-10 py-4 lg:block">
        <LogoLockup />
      </header>

      <main className="flex flex-1 flex-col px-gutter pt-8 pb-gutter lg:items-center lg:px-10 lg:pt-22 lg:pb-24">
        <LogoLockup className="mb-10 lg:hidden" />

        <form onSubmit={onSubmit} className="flex flex-col lg:w-full lg:max-w-115">
          <h1 className="mb-1.5 text-screen lg:mb-3.5 lg:text-screen-lg">Enter your PIN</h1>
          <p className="mb-gutter text-sm leading-normal text-muted-foreground lg:mb-7.5 lg:text-body-lg">
            Six digits, printed on the card at your seat.
            <span className="hidden lg:inline">
              {' '}
              On a laptop you can just type — or paste the whole PIN at once.
            </span>
          </p>

          <Field>
            <FieldLabel htmlFor="pin" className="sr-only">
              Event PIN
            </FieldLabel>
            <Controller
              control={control}
              name="pin"
              render={({ field }) => (
                <InputOTP
                  {...field}
                  id="pin"
                  maxLength={PIN_LENGTH}
                  pattern={REGEXP_ONLY_DIGITS}
                  containerClassName="w-full"
                >
                  <InputOTPGroup className="grid w-full grid-cols-6 gap-2 lg:flex lg:w-auto lg:gap-2.5">
                    {Array.from({ length: PIN_LENGTH }, (_, index) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: the slot's identity is its index
                      <InputOTPSlot key={index} index={index} className={SLOT_CLASS} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              )}
            />
          </Field>

          <Button
            type="submit"
            size="pill"
            disabled={!isComplete}
            // Not anchored to the bottom as the canvas draws it: that gap was the custom
            // keypad, which the native keyboard replaced.
            className="mt-8 w-full lg:mt-6.5 lg:w-50"
          >
            Join event
          </Button>
        </form>
      </main>

      <VersionFooter />
    </div>
  );
}
