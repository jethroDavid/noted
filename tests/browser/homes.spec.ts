import { expect, test } from "@playwright/test";

test("main URL opens the playground fridge", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", { name: "On the fridge." }),
  ).toBeVisible();
  await expect(
    page.getByText("Playground · Changes reset on refresh"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("home switcher explains setup or offers Google sign-in", async ({
  page,
}) => {
  await page.goto("/app/homes");
  await expect(
    page.getByRole("heading", { name: "Your homes." }),
  ).toBeVisible();
  await expect(
    page
      .getByText(
        "Shared homes aren't available yet. You can still try the fridge in the playground.",
      )
      .or(page.getByRole("button", { name: "Continue with Google" })),
  ).toBeVisible();
  await page.getByRole("link", { name: "Playground", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("heading", { name: "On the fridge." }),
  ).toBeVisible();
});

test("home API rejects anonymous access", async ({ request }) => {
  for (const path of ["/api/me", "/api/homes"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in to continue." });
  }
});
