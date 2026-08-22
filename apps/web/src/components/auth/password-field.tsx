import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { AUTH_FIELD } from '@/components/auth/auth-card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** The shared pill field plus a reveal control that is always present, so revealing is not
 * a change of layout. */
export function PasswordField({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'type'>) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={revealed ? 'text' : 'password'}
        className={cn(AUTH_FIELD, 'pr-13', className)}
      />
      <button
        type="button"
        onClick={() => setRevealed((shown) => !shown)}
        aria-label={revealed ? 'Hide password' : 'Show password'}
        className="absolute top-1/2 right-4.5 -translate-y-1/2 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
      >
        {revealed ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
      </button>
    </div>
  );
}
