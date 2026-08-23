import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { $api } from '@/api/client';

export function SignOutButton() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
    <button
      type="button"
      onClick={() => signOut.mutate({})}
      disabled={signOut.isPending}
      className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
    >
      Sign out
    </button>
  );
}
