import "server-only";
import { appRouter, createContext } from "@noted/api/src";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { nativeCorsHeaders } from "../../../../platform/native-cors";

const handler = async (req: Request) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });
  for (const [name, value] of nativeCorsHeaders(req.headers.get("origin"))) {
    if (name === "vary") response.headers.append(name, value);
    else response.headers.set(name, value);
  }
  return response;
};

export function OPTIONS(req: Request) {
  return new Response(null, {
    status: 204,
    headers: nativeCorsHeaders(req.headers.get("origin")),
  });
}

export { handler as GET, handler as POST };
