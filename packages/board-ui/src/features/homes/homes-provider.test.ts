import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createApiClient } from "@noted/api-client";
import { describe, expect, it, vi } from "vitest";
import type { HomesAuth } from "./homes-auth";
import { HomesProvider } from "./homes-provider";
import { useHomes } from "./use-homes";

describe("shared homes provider", () => {
  it("shares one controller with descendants and isolates different providers without a platform SDK", () => {
    const api = createApiClient({ getIdToken: async () => "test-token" });
    const auth: HomesAuth = {
      isConfigured: () => false,
      getAccountId: () => undefined,
      subscribe: vi.fn(() => () => {}),
      signIn: vi.fn(async () => {}),
      signOut: vi.fn(async () => {}),
      errorMessage: () => "Authentication failed.",
    };
    const controllers: ReturnType<typeof useHomes>[] = [];
    function Reader() {
      const homes = useHomes();
      controllers.push(homes);
      return createElement("p", null, homes.mode);
    }
    const first = renderToString(
      createElement(
        HomesProvider,
        { api, auth },
        createElement(Reader),
        createElement(Reader),
      ),
    );
    const second = renderToString(
      createElement(
        HomesProvider,
        {
          api,
          auth: { ...auth, isConfigured: () => true },
        },
        createElement(Reader),
      ),
    );
    expect(first).toBe("<p>setup</p><p>setup</p>");
    expect(second).toBe("<p>loading</p>");
    expect(controllers[0]).toBe(controllers[1]);
    expect(controllers[2]).not.toBe(controllers[0]);
    expect(auth.subscribe).not.toHaveBeenCalled();
  });

  it("explains when a feature component is missing its provider", () => {
    function Reader() {
      useHomes();
      return null;
    }
    expect(() => renderToString(createElement(Reader))).toThrow(
      "useHomes must be used inside HomesProvider.",
    );
  });
});
