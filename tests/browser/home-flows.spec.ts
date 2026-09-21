import { expect, test } from "@playwright/test";
import {
  fixtureHome,
  fixtureMe,
  fixtureUser,
  hasBrowserAuthConfig,
  installBrowserSession,
} from "./home-session";

test.skip(
  !hasBrowserAuthConfig,
  "Requires public Firebase build config; all Firebase and API traffic is mocked.",
);

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) =>
    route.fulfill({
      json: route.request().url().endsWith("/me")
        ? fixtureMe
        : { home: fixtureHome },
    }),
  );
  await installBrowserSession(page);
});

test("signed-in users can keep playing, open the switcher, and sign out", async ({
  page,
}) => {
  await page.goto("/app");
  await expect(page.getByRole("button", { name: "Your homes" })).toBeEnabled();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("button", { name: "Your homes" }).click();
  await expect(page).toHaveURL(/\/app\/homes$/);
  await expect(
    page.getByRole("button", { name: /The Sunday home/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open playground" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("button", { name: "Your homes" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
});

test("home header actions use the shared secondary button", async ({
  page,
}) => {
  await page.goto("/app/homes");
  await page.getByRole("button", { name: /The Sunday home/ }).click();
  const headerAction = page.locator(".app-header-action");
  await expect(
    headerAction.getByRole("button", { name: "Homes", exact: true }),
  ).toHaveClass("secondary-button");
  await expect(
    headerAction.getByRole("button", { name: "Homes", exact: true }),
  ).toHaveCSS("background-color", "rgb(250, 249, 244)");
  await expect(
    headerAction.getByRole("button", { name: "People", exact: true }),
  ).toHaveClass("secondary-button");
});

test("creation dialog handles failure, retries once, and opens the created fridge", async ({
  page,
}) => {
  await page.route("**/api/me", (route) =>
    route.fulfill({ json: { user: fixtureUser, homes: [] } }),
  );
  let attempts = 0;
  await page.route("**/api/homes", async (route) => {
    attempts++;
    if (attempts === 1)
      await route.fulfill({
        status: 503,
        json: { error: "Please try again." },
      });
    else
      await route.fulfill({
        json: { home: { ...fixtureHome, name: "Our kitchen" } },
      });
  });
  await page.goto("/app/homes");
  await page.getByRole("button", { name: "Create a home" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Home name", { exact: true }).fill("   ");
  await expect(
    dialog.getByRole("button", { name: "Create home", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Home name", { exact: true }).fill("Our kitchen");
  await dialog
    .getByRole("button", { name: "Create home", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toHaveText("Please try again.");
  await expect(dialog.getByLabel("Home name", { exact: true })).toHaveValue(
    "Our kitchen",
  );
  await dialog
    .getByRole("button", { name: "Create home", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".home-label")).toHaveAttribute(
    "title",
    "Our kitchen",
  );
  expect(attempts).toBe(2);
});

test("people dialog keeps the fridge in place, traps focus, and reports a saved name", async ({
  page,
}) => {
  await page.goto("/app/homes");
  await page.getByRole("button", { name: /The Sunday home/ }).click();
  await page
    .locator(".fridge-stage")
    .evaluate((element) =>
      Promise.all(
        element.getAnimations().map((animation) => animation.finished),
      ),
    );
  const before = await page.locator(".fridge-stage").boundingBox();
  await page.getByRole("button", { name: "People", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect((await page.locator(".fridge-stage").boundingBox())?.y).toBe(
    before?.y,
  );
  await expect(dialog.getByLabel("Home name", { exact: true })).toHaveValue(
    fixtureHome.name,
  );
  await expect(
    dialog.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.route(`**/api/homes/${fixtureHome.id}`, (route) =>
    route.fulfill({ json: { home: { ...fixtureHome, name: "The kitchen" } } }),
  );
  await dialog.getByLabel("Home name", { exact: true }).fill("The kitchen");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Home name updated.");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "People", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Homes", exact: true }).click();
  await expect(page.getByRole("button", { name: /The kitchen/ })).toBeVisible();
});

test("a late refresh cannot reopen a home after returning to the switcher", async ({
  page,
}) => {
  await page.goto("/app/homes");
  await page.getByRole("button", { name: /The Sunday home/ }).click();
  await expect(
    page.getByRole("button", { name: "People", exact: true }),
  ).toBeVisible();
  let release!: () => void;
  const paused = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const pending = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route(`**/api/homes/${fixtureHome.id}`, async (route) => {
    started();
    await paused;
    await route.fulfill({ json: { home: fixtureHome } });
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await pending;
  await page.getByRole("button", { name: "Homes", exact: true }).click();
  const finished = page.waitForResponse((response) =>
    response.url().endsWith(fixtureHome.id),
  );
  release();
  await finished;
  await expect(
    page.getByRole("heading", { name: "Your homes." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "People", exact: true }),
  ).toHaveCount(0);
});

test("connection errors keep the fridge open; revoked membership closes it", async ({
  page,
}) => {
  await page.goto("/app/homes");
  await page.getByRole("button", { name: /The Sunday home/ }).click();
  await expect(
    page.getByRole("button", { name: "People", exact: true }),
  ).toBeVisible();
  await page.route(`**/api/homes/${fixtureHome.id}`, (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("alert").filter({ hasText: "Couldn't refresh" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "People", exact: true }),
  ).toBeVisible();
  await page.route(`**/api/homes/${fixtureHome.id}`, (route) =>
    route.fulfill({ status: 404, json: { error: "Home not found." } }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("heading", { name: "Your homes." }),
  ).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "no longer have access" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "People", exact: true }),
  ).toHaveCount(0);
});

test("a failed initial load can retry without asking the user to sign in again", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/me", (route) =>
    route.fulfill(
      fail
        ? { status: 503, json: { error: "Temporarily unavailable" } }
        : { json: fixtureMe },
    ),
  );
  await page.goto("/app/homes");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("button", { name: /The Sunday home/ }),
  ).toBeVisible();
});

test("an expired session clears the private fridge and offers sign-in", async ({
  page,
}) => {
  await page.goto("/app/homes");
  await page.getByRole("button", { name: /The Sunday home/ }).click();
  await expect(
    page.getByRole("button", { name: "People", exact: true }),
  ).toBeVisible();
  await page.route("**/api/me", (route) =>
    route.fulfill({ status: 401, json: { error: "Your sign-in expired." } }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "People", exact: true }),
  ).toHaveCount(0);
});

test("member controls and long names fit a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const longName = "A".repeat(80);
  const memberHome = { ...fixtureHome, name: longName, role: "member" };
  await page.route("**/api/me", (route) =>
    route.fulfill({ json: { ...fixtureMe, homes: [memberHome] } }),
  );
  await page.route(`**/api/homes/${fixtureHome.id}`, (route) =>
    route.fulfill({ json: { home: memberHome } }),
  );
  await page.goto("/app/homes");
  await page.getByRole("button", { name: new RegExp(longName) }).click();
  await page.getByRole("button", { name: "People", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Leave this home" }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Invite someone")).toHaveCount(0);
  await expect(dialog.getByLabel("Home name", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
});

test("invitation drafts survive failures and member removal updates the People dialog", async ({
  page,
}) => {
  let currentHome = fixtureHome;
  let attempts = 0;
  await page.route(`**/api/homes/${fixtureHome.id}/invitations`, (route) => {
    attempts++;
    if (attempts === 1)
      return route.fulfill({
        status: 503,
        json: { error: "Please retry the invitation." },
      });
    currentHome = {
      ...currentHome,
      pendingInvitations: [
        {
          id: "00000000-0000-4000-8000-000000000006",
          email: "pat@example.test",
          createdAt: new Date().toISOString(),
        },
      ],
    };
    return route.fulfill({ json: { home: currentHome } });
  });
  await page.route(`**/api/homes/${fixtureHome.id}/members/*`, (route) => {
    currentHome = {
      ...currentHome,
      members: currentHome.members.filter((member) => member.isCreator),
    };
    return route.fulfill({ json: { home: currentHome } });
  });
  await page.goto("/app/homes");
  await page.getByRole("button", { name: /The Sunday home/ }).click();
  await page.getByRole("button", { name: "People", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const email = dialog.getByLabel("Invite someone");
  await email.fill("pat@example.test");
  await dialog.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Please retry the invitation.",
  );
  await expect(email).toHaveValue("pat@example.test");
  await dialog.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(email).toHaveValue("");
  await expect(dialog.getByRole("status")).toContainText("Invitation saved");
  await expect(
    dialog.getByRole("region", { name: "Pending invitations" }),
  ).toContainText("pat@example.test");
  await dialog.getByRole("button", { name: "Remove Sam", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText(
    "Sam was removed from this home.",
  );
  await expect(
    dialog.getByRole("button", { name: "Remove Sam", exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("region", { name: "People in this home" }),
  ).toContainText("1 person");
});

test("leaving a home closes its dialog and returns to the remaining homes", async ({
  page,
}) => {
  const memberHome = { ...fixtureHome, role: "member" };
  await page.route(`**/api/homes/${fixtureHome.id}`, (route) =>
    route.fulfill({ json: { home: memberHome } }),
  );
  await page.route(`**/api/homes/${fixtureHome.id}/membership`, (route) =>
    route.fulfill({ json: { homes: fixtureMe.homes.slice(1) } }),
  );
  await page.goto("/app/homes");
  await page.getByRole("button", { name: /The Sunday home/ }).click();
  await page.getByRole("button", { name: "People", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Leave this home" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Your homes." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /The Sunday home/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /The little apartment/ }),
  ).toBeVisible();
});

test("a failed rename keeps its draft; retry updates the shared fridge and switcher", async ({
  page,
}) => {
  let fail = true;
  await page.route(`**/api/homes/${fixtureHome.id}`, (route) => {
    if (route.request().method() !== "PATCH")
      return route.fulfill({ json: { home: fixtureHome } });
    return route.fulfill(
      fail
        ? { status: 503, json: { error: "Please retry the name change." } }
        : { json: { home: { ...fixtureHome, name: "Our kitchen" } } },
    );
  });
  await page.goto("/app/homes");
  await page.getByRole("button", { name: /The Sunday home/ }).click();
  await page.getByRole("button", { name: "People", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Home name", { exact: true }).fill("Our kitchen");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Please retry the name change.",
  );
  await expect(dialog.getByLabel("Home name", { exact: true })).toHaveValue(
    "Our kitchen",
  );
  await expect(page.locator(".home-label")).toHaveAttribute(
    "title",
    fixtureHome.name,
  );
  fail = false;
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Home name updated.");
  await expect(page.locator(".home-label")).toHaveAttribute(
    "title",
    "Our kitchen",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Homes", exact: true }).click();
  await expect(page.getByRole("button", { name: /Our kitchen/ })).toBeVisible();
});

test("an expired session during an edit clears the dialog and private home", async ({
  page,
}) => {
  await page.goto("/app/homes");
  await page.getByRole("button", { name: /The Sunday home/ }).click();
  await page.getByRole("button", { name: "People", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await page.route(`**/api/homes/${fixtureHome.id}`, (route) =>
    route.fulfill({ status: 401, json: { error: "Session expired." } }),
  );
  await dialog.getByLabel("Home name", { exact: true }).fill("Our kitchen");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("alert").filter({ hasText: "sign-in expired" }),
  ).toBeVisible();
});
