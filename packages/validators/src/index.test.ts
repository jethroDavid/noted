import { describe, expect, it } from "vitest";
import { helloInput } from "./index";

describe("helloInput", () => {
  it("accepts an empty object", () => {
    expect(helloInput.parse({})).toEqual({});
  });

  it("accepts a name", () => {
    expect(helloInput.parse({ name: "Ada" })).toEqual({ name: "Ada" });
  });

  it("rejects an empty name", () => {
    expect(helloInput.safeParse({ name: "" }).success).toBe(false);
  });
});
