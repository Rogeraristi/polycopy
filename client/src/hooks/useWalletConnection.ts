import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const AUTO_CONNECT_STORAGE_KEY = 'polycopy.wallet.autoconnect';

function readStoredAutoConnect(fallback: boolean): boolean {
  if (typeof window === 'undefined') {
    return fallback;
  }
  const raw = window.localStorage.getItem(AUTO_CONNECT_STORAGE_KEY);
  if (raw === null) {
    return fallback;
  }
  return raw === 'true';
}

function writeStoredAutoConnect(value: boolean) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(AUTO_CONNECT_STORAGE_KEY, value ? 'true' : 'false');
}

interface UseWalletConnectionOptions {
  /** Attempt to read already-connected accounts on mount (default true). */
  autoConnect?: boolean;
  /** Optional list of preferred wallet addresses; mainly for tests. */
  preferredAccounts?: string[];
}

interface WalletConnection {
  address: string | null;
  chainId: string | null;
  isConnecting: boolean;
  isConnected: boolean;
  providerAvailable: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  resetError: () => void;
}

type AccountsChangedHandler = (accounts: string[]) => void;
type ChainChangedHandler = (chainId: string) => void;

function getEthereumProvider(): Eip1193Provider | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.ethereum;
}

function normaliseAddress(address: string | undefined | null): string | null {
  if (!address) {
    return null;
  }
  return address.trim().toLowerCase();
}

export function useWalletConnection(options: UseWalletConnectionOptions = {}): WalletConnection {
  const { autoConnect = true, preferredAccounts } = options;
  const providerRef = useRef<Eip1193Provider | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldAutoConnect, setShouldAutoConnect] = useState<boolean>(() => readStoredAutoConnect(autoConnect));
  const acceptAccountsRef = useRef<boolean>(shouldAutoConnect);

  const updateAutoConnect = useCallback((nextValue: boolean) => {
    acceptAccountsRef.current = nextValue;
    setShouldAutoConnect(nextValue);
    writeStoredAutoConnect(nextValue);
  }, []);

  useEffect(() => {
    const reconciled = readStoredAutoConnect(autoConnect);
    updateAutoConnect(reconciled);
  }, [autoConnect, updateAutoConnect]);

  const provider = getEthereumProvider();
  providerRef.current = provider ?? null;

  const handleAccountsChanged = useCallback<AccountsChangedHandler>(
    (accounts) => {
      if (!acceptAccountsRef.current) {
        setAddress(null);
        setChainId(null);
        return;
      }

      const [firstAccount] = Array.isArray(accounts) ? accounts : [];
      const nextAccount = normaliseAddress(firstAccount);
      setAddress(nextAccount);
      if (!nextAccount) {
        setChainId(null);
      }
    },
    [setAddress]
  );

  const handleChainChanged = useCallback<ChainChangedHandler>(
    (nextChainId) => {
      if (!acceptAccountsRef.current) {
        setChainId(null);
        return;
      }
      setChainId(typeof nextChainId === 'string' ? nextChainId : null);
    },
    [setChainId]
  );

  const connect = useCallback(async () => {
    const activeProvider = providerRef.current;
    if (!activeProvider) {
      setError('No EIP-1193 wallet was detected. Install MetaMask or a compatible wallet extension.');
      return;
    }

    setIsConnecting(true);
    setError(null);
    const previousAcceptState = acceptAccountsRef.current;
    const previousAddress = address;
    const previousChain = chainId;
    try {
      let accounts: string[] = [];
      acceptAccountsRef.current = true;
      if (Array.isArray(preferredAccounts) && preferredAccounts.length > 0) {
        accounts = preferredAccounts;
      } else {
        const canRequestPermissions = typeof activeProvider.request === 'function';
        if (canRequestPermissions) {
          try {
            await activeProvider.request({
              method: 'wallet_requestPermissions',
              params: [{ eth_accounts: {} }]
            });
          } catch (permissionsError) {
            // Some wallets do not support wallet_requestPermissions; fall back to eth_requestAccounts.
            if ((permissionsError as { code?: number })?.code !== -32601) {
              throw permissionsError;
            }
          }
        }
        accounts = await activeProvider.request<string[]>({
          method: 'eth_requestAccounts'
        });
      }
      handleAccountsChanged(accounts);

      const nextChain = await activeProvider.request<string>({
        method: 'eth_chainId'
      });
      handleChainChanged(nextChain);
      updateAutoConnect(true);
    } catch (requestError) {
      if ((requestError as { code?: number })?.code === 4001) {
        // User rejected the request.
        setError('Wallet connection was rejected.');
      } else {
        const message =
          requestError instanceof Error ? requestError.message : 'Unable to connect to the wallet right now.';
        setError(message);
      }
      updateAutoConnect(previousAcceptState);
      setAddress(previousAddress ?? null);
      setChainId(previousChain ?? null);
    } finally {
      setIsConnecting(false);
    }
  }, [address, chainId, handleAccountsChanged, handleChainChanged, preferredAccounts, updateAutoConnect]);

  const disconnect = useCallback(() => {
    updateAutoConnect(false);
    setAddress(null);
    setChainId(null);
    setError(null);

    const activeProvider = providerRef.current;
    if (activeProvider && typeof activeProvider.request === 'function') {
      void activeProvider
        .request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }]
        })
        .catch(() => {
          // Ignore wallets that do not support permission revocation.
        });
    }
  }, [updateAutoConnect]);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    const activeProvider = providerRef.current;
    if (!activeProvider) {
      setAddress(null);
      setChainId(null);
      return;
    }

    let isMounted = true;
    let listenersAttached = false;

    const handleDisconnect = () => {
      if (!isMounted) {
        return;
      }
      setAddress(null);
      setChainId(null);
    };

    const handleProviderDisconnect = () => {
      handleDisconnect();
      updateAutoConnect(false);
    };

    if (shouldAutoConnect) {
      if (typeof activeProvider.on === 'function') {
        activeProvider.on('accountsChanged', handleAccountsChanged);
        activeProvider.on('chainChanged', handleChainChanged);
        activeProvider.on('disconnect', handleProviderDisconnect);
        listenersAttached = true;
      }

      (async () => {
        try {
          const [accounts, currentChainId] = await Promise.all([
            activeProvider.request<string[]>({ method: 'eth_accounts' }),
            activeProvider.request<string>({ method: 'eth_chainId' }).catch(() => null)
          ]);
          if (!isMounted) {
            return;
          }
          handleAccountsChanged(accounts);
          if (currentChainId) {
            handleChainChanged(currentChainId);
          }
        } catch (initialError) {
          if (!isMounted) return;
          const message =
            initialError instanceof Error ? initialError.message : 'Failed to read wallet state.';
          setError(message);
        }
      })();
    } else {
      handleDisconnect();
    }

    return () => {
      isMounted = false;
      if (!listenersAttached) {
        return;
      }
      if (typeof activeProvider.removeListener === 'function') {
        activeProvider.removeListener('accountsChanged', handleAccountsChanged);
        activeProvider.removeListener('chainChanged', handleChainChanged);
        activeProvider.removeListener('disconnect', handleProviderDisconnect);
      } else if (typeof activeProvider.removeAllListeners === 'function') {
        activeProvider.removeAllListeners('accountsChanged');
        activeProvider.removeAllListeners('chainChanged');
        activeProvider.removeAllListeners('disconnect');
      }
    };
  }, [handleAccountsChanged, handleChainChanged, shouldAutoConnect, updateAutoConnect]);

  return useMemo(
    () => ({
      address,
      chainId,
      isConnecting,
      isConnected: Boolean(address),
      providerAvailable: Boolean(providerRef.current),
      error,
      connect,
      disconnect,
      resetError
    }),
    [address, chainId, connect, disconnect, error, isConnecting, resetError]
  );
}
