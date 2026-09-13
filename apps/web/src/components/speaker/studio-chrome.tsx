import { AppHeader } from '@/components/app-header';
import { LogoLockup } from '@/components/logo-lockup';
import { TempThemeToggle } from '@/components/temp-theme-toggle';

export function StudioChrome() {
  return (
    <>
      <AppHeader right={<TempThemeToggle />} />
      <div className="mx-auto flex w-full max-w-shell items-center justify-between gap-3 px-gutter pt-6 lg:hidden">
        <LogoLockup />
        <TempThemeToggle />
      </div>
    </>
  );
}
