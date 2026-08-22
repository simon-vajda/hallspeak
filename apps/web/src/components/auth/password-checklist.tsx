import { Check } from 'lucide-react';
import { evaluatePassword } from '@/lib/password-rules';
import { cn } from '@/lib/utils';

/** Three lines, always all three: a rule that disappeared once met would move the fields. */
export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {evaluatePassword(password).map((rule) => (
        <li
          key={rule.id}
          className={cn(
            'flex items-center gap-2 text-meta transition-colors',
            // Not a `live` role: that colour means on air, and borrowing it here would be the
            // one thing the palette rule forbids.
            rule.satisfied ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          <Check
            className={cn('size-3.5 shrink-0', rule.satisfied ? 'opacity-100' : 'opacity-30')}
            strokeWidth={3}
          />
          {rule.label}
        </li>
      ))}
    </ul>
  );
}
