import { PHOTO_FIXTURES } from "@noted/domain/src";
import { photoFixtureKeySchema } from "@noted/validators/src";
import { describe, expect, it } from "vitest";

// Validators cannot import the domain leaf, so it mirrors the fixture keys.
// This test fails loudly if the two lists drift apart.
describe("photo fixture parity", () => {
  it("matches the domain catalog", () => {
    expect([...photoFixtureKeySchema.options]).toEqual(
      PHOTO_FIXTURES.map((fixture) => fixture.key),
    );
  });
});
