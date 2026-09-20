import { expect, test } from "vitest";
import { inviteMemberSchema } from "./index";

test("normalizes a pasted invitation address before validating it", () => {
  expect(inviteMemberSchema.parse({ email: "  Alice@Example.com  " })).toEqual({
    email: "alice@example.com",
  });
  expect(inviteMemberSchema.safeParse({ email: "not an email" }).success).toBe(
    false,
  );
});
