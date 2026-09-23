/** Query keys for the homes feature. Keys carry the account so cached data can never leak across accounts. */
export const homesPrefix = ["homes"] as const;

export function meKey(accountId: string | undefined) {
  return [...homesPrefix, "me", accountId] as const;
}

export function homeKey(
  accountId: string | undefined,
  homeId: string | undefined,
) {
  return [...homesPrefix, "home", accountId, homeId] as const;
}
