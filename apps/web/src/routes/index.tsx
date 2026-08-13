import { zodResolver } from '@hookform/resolvers/zod';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { Controller, useForm } from 'react-hook-form';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { type PinFormValues, pinFormSchema } from '@/lib/pin-form';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/')({ component: IndexPage });

const PIN_LENGTH = 6;

// The design draws separated rounded boxes; shadcn's default slot is one joined group,
// so most of this is unpicking that. The nested `[&>div>div]` is input-otp's fake caret,
// which the component renders internally and no prop reaches.
const SLOT_CLASS = cn(
  'h-14 w-full rounded-[14px] border-2 border-transparent bg-secondary text-[21px]',
  'font-semibold text-foreground transition-colors dark:bg-secondary',
  'first:rounded-[14px] first:border-2 last:rounded-[14px]',
  // The dark: pair is repeated on the active state so it outranks dark:bg-secondary above.
  'data-[active=true]:border-primary data-[active=true]:ring-0',
  'data-[active=true]:bg-primary/10 dark:data-[active=true]:bg-primary/10',
  '[&>div>div]:h-[22px] [&>div>div]:w-0.5 [&>div>div]:bg-primary',
  // rounded-md, not rounded-2xl: this scale is derived from --radius (20px), so the
  // design's 16px box is 0.8 × radius, and rounded-2xl would be 36px.
  'lg:h-[74px] lg:w-[62px] lg:rounded-md lg:text-[28px]',
  'lg:first:rounded-md lg:last:rounded-md lg:[&>div>div]:h-7',
);

function LogoLockup({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="size-[26px] rounded-full bg-primary lg:size-[22px]" />
      {/* leading-none so the circle, not the body line-height, sets the lockup's height */}
      <span className="text-lg leading-none font-semibold tracking-[-0.03em] lg:text-[17px]">
        LinguaCast
      </span>
    </div>
  );
}

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
      <div className="absolute top-3.5 right-[26px] z-10 lg:top-4 lg:right-10">
        <TempThemeToggle />
      </div>

      {/* Desktop carries the lockup in a header bar; mobile carries it in the column. */}
      <header className="hidden border-b border-border px-10 py-4 lg:block">
        <LogoLockup />
      </header>

      <main className="flex flex-1 flex-col px-[26px] pt-8 pb-[26px] lg:items-center lg:px-10 lg:pt-[88px] lg:pb-24">
        <LogoLockup className="mb-10 lg:hidden" />

        <form onSubmit={onSubmit} className="flex flex-col lg:w-full lg:max-w-[460px]">
          <h1 className="mb-1.5 text-3xl leading-[1.06] font-semibold tracking-[-0.035em] lg:mb-3.5 lg:text-[52px] lg:leading-[1.02] lg:tracking-[-0.045em]">
            Enter your PIN
          </h1>
          <p className="mb-[26px] text-sm leading-normal text-muted-foreground lg:mb-[30px] lg:text-[17px] lg:leading-[1.6]">
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
            // 10a anchors this to the bottom because the keypad filled the gap. With the
            // keypad dropped for the native keyboard, the README's rhythm (32px above a
            // primary action) keeps it with the field instead of behind the keyboard.
            className="mt-8 w-full lg:mt-[26px] lg:w-[200px]"
          >
            Join event
          </Button>
        </form>
      </main>
    </div>
  );
}
