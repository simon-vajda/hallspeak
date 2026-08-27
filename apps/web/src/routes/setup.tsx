import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { AuthCard } from '@/components/auth/auth-card';
import { SetupCredentialsForm } from '@/components/auth/setup-credentials-form';
import { SetupWelcome } from '@/components/auth/setup-welcome';
import { MICRO_LABEL } from '@/components/micro-label';
import { sessionQueryOptions } from '@/lib/auth-queries';
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

function SetupPage() {
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <AuthCard className="lg:max-w-130">
      <StepPips step={step} />
      {step === 1 ? <SetupWelcome onContinue={() => setStep(2)} /> : <SetupCredentialsForm />}
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
