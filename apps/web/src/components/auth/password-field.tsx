import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * The pill field from `12g`: 52px, filled at rest, and a two-pixel ring on focus, the same
 * treatment as the PIN boxes. The reveal control is always present, so revealing is not a
 * change of layout.
 */
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
        className={cn(
          'h-13 rounded-full border-2 border-transparent bg-secondary px-5 pr-13 text-base',
          'focus-visible:border-primary focus-visible:bg-card focus-visible:ring-0',
          'aria-invalid:border-destructive aria-invalid:ring-0',
          className,
        )}
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
