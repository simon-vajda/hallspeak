import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { $api } from '@/api/client';
import { sessionKey } from '@/lib/auth-queries';

export function SignOutButton() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOut = $api.useMutation('post', '/auth/logout', {
    onSettled: async () => {
      // Settled, not success: the cookie is cleared either way, so the screen must not stay
      // on an admin page it can no longer load.
      queryClient.clear();
      await navigate({ to: '/login' });
      await queryClient.invalidateQueries({ queryKey: sessionKey() });
    },
  });

  return (
    <button
      type="button"
      onClick={() => signOut.mutate({})}
      disabled={signOut.isPending}
      className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
    >
      Sign out
    </button>
  );
}
