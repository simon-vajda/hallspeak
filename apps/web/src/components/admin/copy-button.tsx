import { Check, Copy } from 'lucide-react';
import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CONFIRM_MS = 2000;

/**
 * `navigator.clipboard` is undefined on an insecure origin, which a self-hosted server over
 * plain HTTP is, so the failure path reveals the text and leaves it selectable.
 */
export function CopyButton({
  value,
  label,
  copiedLabel = 'Copied',
  variant = 'default',
  size = 'action',
  className,
  wrapperClassName,
}: {
  value: string;
  label: string;
  copiedLabel?: string;
  variant?: 'default' | 'outline';
  size?: ComponentProps<typeof Button>['size'];
  className?: string;
  wrapperClassName?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copied = state === 'copied';

  return (
    <div className={cn('flex flex-col gap-2', wrapperClassName)}>
      <Button
        variant={variant}
        size={size}
        className={cn('gap-2', className)}
        onClick={async () => {
          clearTimeout(timer.current);
          try {
            await navigator.clipboard.writeText(value);
            setState('copied');
            timer.current = setTimeout(() => setState('idle'), CONFIRM_MS);
          } catch {
            setState('failed');
          }
        }}
      >
        {copied ? <Check /> : <Copy />}
        {copied ? copiedLabel : label}
      </Button>

      {state === 'failed' && (
        <div role="status" className="text-left text-meta text-muted-foreground">
          <p>This browser would not let us copy — select the link instead:</p>
          <code className="mt-1 block select-all break-all font-mono text-foreground">{value}</code>
        </div>
      )}
    </div>
  );
}
