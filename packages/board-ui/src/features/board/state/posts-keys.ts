/** Query keys for the board-posts feature. Keys carry the account so cached data can never leak across accounts. */
export const boardPostsPrefix = ["board-posts"] as const;

export function boardPostsKey(
  accountId: string | undefined,
  homeId: string | undefined,
  boardId: string | undefined,
) {
  return [...boardPostsPrefix, "board", accountId, homeId, boardId] as const;
}
