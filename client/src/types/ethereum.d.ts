interface Eip1193Provider {
  request<T = unknown>(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<T>;
  on?(event: string, listener: (...args: any[]) => void): void;
  removeListener?(event: string, listener: (...args: any[]) => void): void;
  removeAllListeners?(event: string): void;
  isMetaMask?: boolean;
  chainId?: string;
  selectedAddress?: string;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export {};
