interface WalletStatusProps {
  address: string | null;
  chainId: string | null;
  isConnecting: boolean;
  isConnected: boolean;
  providerAvailable: boolean;
  error: string | null;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
  onDismissError: () => void;
}

function shortenAddress(address: string | null) {
  if (!address) {
    return null;
  }
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletStatus({
  address,
  chainId,
  isConnecting,
  isConnected,
  providerAvailable,
  error,
  onConnect,
  onDisconnect,
  onDismissError
}: WalletStatusProps) {
  const shortAddress = shortenAddress(address);

  return (
    <section className="rounded-3xl border border-slate-800/60 bg-slate-950/70 p-6 shadow-lg shadow-slate-950/40">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">{isConnected ? 'Wallet Connected' : 'Wallet'}</p>
          <h2 className="text-xl font-semibold text-slate-100">
            {isConnected ? 'Ready to mirror trades' : 'Connect your Polymarket wallet'}
          </h2>
        </div>
        {isConnected ? (
          <button
            type="button"
            onClick={onDisconnect}
            className="inline-flex items-center justify-center rounded-full border border-slate-700/80 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800/60"
          >
            Forget wallet
          </button>
        ) : (
          <button
            type="button"
            disabled={isConnecting || !providerAvailable}
            onClick={() => {
              void onConnect();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary/90 px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:bg-slate-800/60 disabled:text-slate-400"
          >
            {isConnecting ? 'Connecting…' : providerAvailable ? 'Connect wallet' : 'Wallet not detected'}
          </button>
        )}
      </header>

      <div className="mt-5 grid gap-4 rounded-2xl border border-slate-800/70 bg-slate-900/60 p-5 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Address</p>
          <p className="mt-1 font-mono text-sm text-slate-200">
            {shortAddress ?? (providerAvailable ? 'Not connected' : 'Install MetaMask or Rabby')}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Network</p>
          <p className="mt-1 text-sm text-slate-200">
            {chainId ? `Chain ${chainId}` : isConnected ? 'Unknown chain' : '—'}
          </p>
        </div>
      </div>

      {!providerAvailable && (
        <p className="mt-4 text-sm text-slate-400">
          We could not detect an EIP-1193 provider in your browser. Install a wallet extension such as MetaMask, reload
          the page, and try again.
        </p>
      )}

      {error && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-rose-600/50 bg-rose-600/10 p-4 text-sm text-rose-200">
          <p>{error}</p>
          <button
            type="button"
            onClick={onDismissError}
            className="self-start rounded-full border border-rose-400/50 px-4 py-1 text-xs font-semibold text-rose-100 transition hover:border-rose-200 hover:text-rose-50"
          >
            Dismiss
          </button>
        </div>
      )}
    </section>
  );
}
