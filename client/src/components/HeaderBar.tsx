import type { SessionUser } from '../hooks/useSession';

interface HeaderBarProps {
  user: SessionUser | null;
  isSessionLoading: boolean;
  isSessionActionPending: boolean;
  onLogin: () => void;
  onLogout: () => Promise<void>;
  walletAddress: string | null;
  walletChainId: string | null;
  isWalletConnecting: boolean;
  isWalletConnected: boolean;
  walletProviderAvailable: boolean;
  onConnectWallet: () => Promise<void>;
  onDisconnectWallet: () => void;
}

function getInitials(user: SessionUser | null) {
  if (!user?.name) return null;
  const parts = user.name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

function shortenAddress(address: string | null) {
  if (!address) return null;
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function HeaderBar({
  user,
  isSessionLoading,
  isSessionActionPending,
  onLogin,
  onLogout,
  walletAddress,
  walletChainId,
  isWalletConnecting,
  isWalletConnected,
  walletProviderAvailable,
  onConnectWallet,
  onDisconnectWallet
}: HeaderBarProps) {
  const initials = getInitials(user);
  const shortAddress = shortenAddress(walletAddress);
  const walletLabel = !walletProviderAvailable
    ? 'Wallet not detected'
    : isWalletConnecting
    ? 'Connecting…'
    : isWalletConnected
    ? `Disconnect ${shortAddress ?? 'wallet'}`
    : 'Connect wallet';

  const handleSessionClick = () => {
    if (user) {
      void onLogout();
    } else {
      onLogin();
    }
  };

  const handleWalletClick = () => {
    if (!walletProviderAvailable) {
      return;
    }
    if (isWalletConnected) {
      onDisconnectWallet();
    } else {
      void onConnectWallet();
    }
  };

  return (
    <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-primary/80">PolyCopy</p>
        <h1 className="text-2xl font-semibold text-slate-100 sm:text-3xl">Mirror elite Polymarket traders</h1>
      </div>
      <div className="flex items-center gap-3 self-end sm:self-auto">
        <button
          type="button"
          onClick={handleSessionClick}
          disabled={isSessionLoading || isSessionActionPending}
          className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800/70 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
        >
          {isSessionLoading
            ? 'Loading…'
            : user
            ? (
                <>
                  {initials && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800/80 text-xs font-semibold">
                      {initials}
                    </span>
                  )}
                  Sign out
                </>
              )
            : 'Sign in with Google'}
        </button>
        <button
          type="button"
          onClick={handleWalletClick}
          disabled={isWalletConnecting || !walletProviderAvailable}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
            isWalletConnected
              ? 'border border-emerald-400/50 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300 hover:bg-emerald-500/20'
              : walletProviderAvailable
              ? 'bg-primary px-5 text-white hover:bg-primary/90'
              : 'border border-slate-700/70 bg-slate-900/60 text-slate-500'
          } disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/60 disabled:text-slate-500`}
        >
          {walletLabel}
          {isWalletConnected && walletChainId && (
            <span className="text-[10px] uppercase tracking-wide text-emerald-200/80">Chain {walletChainId}</span>
          )}
        </button>
      </div>
    </header>
  );
}
