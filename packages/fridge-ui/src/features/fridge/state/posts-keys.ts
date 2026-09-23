/** Query keys for the fridge-posts feature. Keys carry the account so cached data can never leak across accounts. */
export const fridgePostsPrefix = ["fridge-posts"] as const;

export function boardPostsKey(
  accountId: string | undefined,
  homeId: string | undefined,
  boardId: string | undefined,
) {
  return [...fridgePostsPrefix, "board", accountId, homeId, boardId] as const;
}
