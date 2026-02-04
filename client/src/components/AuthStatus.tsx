import type { SessionUser } from '../hooks/useSession';

interface AuthStatusProps {
  user: SessionUser | null;
  isLoading: boolean;
  isActionPending: boolean;
  error: string | null;
  onLogin: () => void;
  onLogout: () => Promise<void>;
}

function getInitials(user: SessionUser | null) {
  if (!user?.name) {
    return 'U';
  }
  const trimmed = user.name.trim();
  if (!trimmed) {
    return 'U';
  }
  const tokens = trimmed.split(/\s+/).slice(0, 2);
  if (tokens.length === 1) {
    return tokens[0].charAt(0).toUpperCase();
  }
  return `${tokens[0].charAt(0)}${tokens[1].charAt(0)}`.toUpperCase();
}

export function AuthStatus({ user, isLoading, isActionPending, error, onLogin, onLogout }: AuthStatusProps) {
  const initials = getInitials(user);
  const showAvatar = Boolean(user?.avatar);

  const handleLogin = () => {
    onLogin();
  };

  const handleLogout = () => {
    void onLogout();
  };

  return (
    <section className="rounded-3xl border border-slate-800/60 bg-slate-950/70 p-6 shadow-lg shadow-slate-950/40">
      {isLoading ? (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 animate-pulse rounded-full bg-slate-800/70" />
            <div className="space-y-2">
              <div className="h-3 w-32 animate-pulse rounded bg-slate-800/70" />
              <div className="h-3 w-40 animate-pulse rounded bg-slate-800/50" />
            </div>
          </div>
          <div className="h-9 w-36 animate-pulse rounded-full bg-slate-800/60" />
        </div>
      ) : user ? (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {showAvatar ? (
              <img
                src={user.avatar ?? ''}
                alt={user.name}
                className="h-12 w-12 rounded-full border border-slate-700 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-800/60 text-lg font-semibold text-slate-200">
                {initials}
              </div>
            )}
            <div>
              <p className="text-sm uppercase tracking-wide text-slate-400">Signed in as</p>
              <p className="text-lg font-semibold text-slate-100">{user.name}</p>
              {user.email && <p className="text-sm text-slate-400">{user.email}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isActionPending}
            className="inline-flex items-center justify-center rounded-full border border-slate-700/80 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/60 disabled:text-slate-500"
          >
            {isActionPending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-400">Authentication</p>
            <h2 className="text-xl font-semibold text-slate-100">Sign in to link your Polymarket wallet</h2>
            <p className="mt-1 text-sm text-slate-400">
              Use Google to save preferences and manage trading automation access for your account.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogin}
            className="inline-flex items-center justify-center rounded-full bg-emerald-500/90 px-5 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            Sign in with Google
          </button>
        </div>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-pink-500/40 bg-pink-500/10 px-3 py-2 text-sm text-pink-200">
          {error}
        </p>
      )}
    </section>
  );
}
