import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export function rendererAsset(root: string, request: string): string | null {
  try {
    const url = new URL(request);
    if (url.protocol !== "noted:" || url.hostname !== "app") return null;
    const path = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    return path.startsWith(resolve(root) + sep)
      ? pathToFileURL(path).href
      : null;
  } catch {
    return null;
  }
}

export function isSignInNavigation(request: string, apiUrl: string): boolean {
  try {
    const url = new URL(request);
    return (
      !url.username &&
      !url.password &&
      url.origin === new URL(apiUrl).origin &&
      url.pathname === "/native-auth"
    );
  } catch {
    return false;
  }
}
