export function authErrorMessage(cause: unknown): string | null {
  const code =
    cause && typeof cause === "object" && "code" in cause ? cause.code : null;
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null;
    case "auth/popup-blocked":
      return "Allow pop-ups for this site, then try signing in again.";
    case "auth/network-request-failed":
      return "We couldn't connect to Google. Check your connection and try again.";
    default:
      return "We couldn't sign you in. Please try again.";
  }
}
