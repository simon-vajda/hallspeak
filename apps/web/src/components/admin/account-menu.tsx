import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronDown, KeyRound, LogOut, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { $api } from '@/api/client';
import { ChangePasswordDialog } from '@/components/admin/change-password-dialog';
import { useTheme } from '@/components/theme-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { sessionQueryOptions } from '@/lib/auth-queries';
import { themeFlip } from '@/lib/theme-flip';

export function AccountMenu() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useQuery(sessionQueryOptions());
  const username = session?.username ?? '';
  const { theme, setTheme } = useTheme();
  const [changingPassword, setChangingPassword] = useState(false);

  const signOut = $api.useMutation('post', '/auth/logout', {
    onSettled: async () => {
      // Settled, not success: the cookie is cleared either way, so the screen must not stay
      // on an admin page it can no longer load. Cleared rather than invalidated, so the
      // sign-in guard refetches instead of reading an entry that still says signed in —
      // and so no admin data outlives the session that fetched it.
      queryClient.clear();
      await navigate({ to: '/login' });
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-touch min-w-0 cursor-pointer items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 data-popup-open:text-foreground lg:h-action">
          <span className="max-w-24 truncate sm:max-w-40 lg:max-w-56">{username}</span>
          <ChevronDown className="size-4 shrink-0" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-48">
          <DropdownMenuItem onClick={() => setChangingPassword(true)}>
            <KeyRound />
            Change password
          </DropdownMenuItem>
          <ThemeItem theme={theme} onSelect={setTheme} />
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={signOut.isPending} onClick={() => signOut.mutate({})}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordDialog
        open={changingPassword}
        onOpenChange={setChangingPassword}
        username={username}
      />
    </>
  );
}

function ThemeItem({
  theme,
  onSelect,
}: {
  theme: ReturnType<typeof useTheme>['theme'];
  onSelect: (theme: 'light' | 'dark') => void;
}) {
  const { next, label } = themeFlip(
    theme,
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  return (
    <DropdownMenuItem onClick={() => onSelect(next)}>
      {next === 'light' ? <Sun /> : <Moon />}
      {label}
    </DropdownMenuItem>
  );
}
