import { describe, expect, it } from "vitest";
import { homeKey, homesPrefix, meKey } from "./homes-keys";

describe("homes query keys", () => {
  it("scopes the profile and home entries by account", () => {
    expect(meKey("account-1")).toEqual(["homes", "me", "account-1"]);
    expect(homeKey("account-1", "home-1")).toEqual([
      "homes",
      "home",
      "account-1",
      "home-1",
    ]);
  });

  it("gives each account its own cache entries", () => {
    expect(meKey("account-1")).not.toEqual(meKey("account-2"));
    expect(homeKey("account-1", "home-1")).not.toEqual(
      homeKey("account-2", "home-1"),
    );
  });

  it("shares one prefix so sign-out can clear every homes entry", () => {
    expect(homesPrefix).toEqual(["homes"]);
    expect(meKey("account-1").slice(0, 1)).toEqual([...homesPrefix]);
    expect(homeKey("account-1", "home-1").slice(0, 1)).toEqual([
      ...homesPrefix,
    ]);
  });
});
