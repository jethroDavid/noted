/** Supplied once by the application shell; no platform SDK enters this feature. */
export type HomesAuth = {
  isConfigured: () => boolean;
  getAccountId: () => string | undefined;
  subscribe: (
    onAccountChanged: (accountId: string | undefined) => void,
    onError: (cause: unknown) => void,
  ) => () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  errorMessage: (cause: unknown) => string | null;
};
