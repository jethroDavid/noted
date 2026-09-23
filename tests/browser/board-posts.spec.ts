import { expect, test } from "@playwright/test";
import {
  fixtureHome,
  fixtureMe,
  hasBrowserAuthConfig,
  installBrowserSession,
} from "./home-session";

test.skip(
  !hasBrowserAuthConfig,
  "Requires public Firebase build config; all Firebase and API traffic is mocked.",
);

type MockPost = {
  id: string;
  boardId: string;
  kind: "text";
  text: string;
  foregroundColor: string;
  backgroundColor: string;
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
  deletionRequestedAt: string | null;
  deleteAfter: string | null;
};

type MockBoard = {
  board: { id: string; homeId: string; postAdditions: number };
  posts: MockPost[];
};

const boardA = "00000000-0000-4000-8000-000000000003";
const homeA = fixtureHome.id;
const homeB = "00000000-0000-4000-8000-000000000005";

function mockPost(homeId: string, overrides?: Partial<MockPost>): MockPost {
  const stamp = new Date().toISOString();
  return {
    id: "10000000-0000-4000-8000-000000000001",
    boardId: boardA,
    kind: "text",
    text: "Alice's note",
    foregroundColor: "#33352e",
    backgroundColor: "#f5dfa0",
    x: 0.3,
    y: 0.4,
    createdAt: stamp,
    updatedAt: stamp,
    deletionRequestedAt: null,
    deleteAfter: null,
    ...overrides,
  };
}

function mockBoard(homeId: string, posts: MockPost[]): MockBoard {
  return {
    board: { id: boardA, homeId, postAdditions: posts.length },
    posts,
  };
}

// One in-memory backend per test; the app and the test share it so a poll can
// pick up another member's note. Tests run serially (workers: 1).
let boards: Record<string, MockBoard>;
let boardGets: number;
let lastBodies: Record<string, unknown>;
let boardStatus: number;

test.beforeEach(async ({ page }) => {
  boards = {
    [homeA]: mockBoard(homeA, [mockPost(homeA)]),
    [homeB]: mockBoard(homeB, [
      mockPost(homeB, {
        id: "10000000-0000-4000-8000-000000000002",
        text: "Beta home note",
      }),
    ]),
  };
  boardGets = 0;
  lastBodies = {};
  boardStatus = 200;

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const parts = url.pathname.split("/").filter(Boolean);

    if (url.pathname === "/api/me") {
      await route.fulfill({ json: fixtureMe });
      return;
    }
    if (parts[0] === "api" && parts[1] === "homes" && parts.length === 3) {
      const homeId = decodeURIComponent(parts[2]);
      await route.fulfill({
        json: {
          home: {
            ...fixtureHome,
            id: homeId,
            name: homeId === homeB ? "The little apartment" : fixtureHome.name,
          },
        },
      });
      return;
    }
    if (parts[3] === "boards" && parts.length === 5 && method === "GET") {
      boardGets += 1;
      if (boardStatus !== 200) {
        await route.fulfill({
          status: boardStatus,
          json: { error: "Home not found." },
        });
        return;
      }
      const homeId = decodeURIComponent(parts[2]);
      await route.fulfill({
        json: { ...boards[homeId], serverTime: new Date().toISOString() },
      });
      return;
    }
    if (parts[3] === "boards" && parts[5] === "posts" && method === "POST") {
      const homeId = decodeURIComponent(parts[2]);
      const body = (await route.request().postDataJSON()) as {
        text: string;
        foregroundColor: string;
        backgroundColor: string;
        x: number;
        y: number;
      };
      lastBodies.create = body;
      const stamp = new Date().toISOString();
      const post = mockPost(homeId, {
        id: `20000000-0000-4000-8000-${String(boards[homeId].posts.length + 1).padStart(12, "0")}`,
        ...body,
        createdAt: stamp,
        updatedAt: stamp,
      });
      boards[homeId].posts.push(post);
      boards[homeId].board.postAdditions += 1;
      await route.fulfill({ json: { post }, status: 201 });
      return;
    }
    if (parts[3] === "posts" && parts.length === 5 && method === "PATCH") {
      const homeId = decodeURIComponent(parts[2]);
      const postId = decodeURIComponent(parts[4]);
      const body = (await route.request().postDataJSON()) as {
        text: string;
        foregroundColor: string;
        backgroundColor: string;
      };
      lastBodies.edit = body;
      const post = boards[homeId].posts.find((item) => item.id === postId);
      if (!post) {
        await route.fulfill({
          status: 404,
          json: { error: "Post not found." },
        });
        return;
      }
      Object.assign(post, { ...body, updatedAt: new Date().toISOString() });
      await route.fulfill({ json: { post } });
      return;
    }
    if (parts[3] === "posts" && parts[5] === "position" && method === "PATCH") {
      const homeId = decodeURIComponent(parts[2]);
      const postId = decodeURIComponent(parts[4]);
      const body = (await route.request().postDataJSON()) as {
        x: number;
        y: number;
      };
      lastBodies.move = body;
      const post = boards[homeId].posts.find((item) => item.id === postId);
      if (!post) {
        await route.fulfill({
          status: 404,
          json: { error: "Post not found." },
        });
        return;
      }
      Object.assign(post, { ...body, updatedAt: new Date().toISOString() });
      await route.fulfill({ json: { post } });
      return;
    }
    if (parts[3] === "posts" && parts[5] === "removal") {
      const homeId = decodeURIComponent(parts[2]);
      const postId = decodeURIComponent(parts[4]);
      lastBodies.removal = { method };
      const post = boards[homeId].posts.find((item) => item.id === postId);
      if (!post) {
        await route.fulfill({
          status: 404,
          json: { error: "Post not found." },
        });
        return;
      }
      if (method === "POST") {
        const requested = new Date().toISOString();
        post.deletionRequestedAt ??= requested;
        post.deleteAfter ??= new Date(Date.now() + 3_600_000).toISOString();
      } else {
        post.deletionRequestedAt = null;
        post.deleteAfter = null;
      }
      await route.fulfill({ json: { post } });
      return;
    }
    await route.fulfill({ json: { home: fixtureHome } });
  });
  await installBrowserSession(page);
});

async function openHome(page: import("@playwright/test").Page, name: RegExp) {
  await page.goto("/app/homes");
  await page.getByRole("button", { name }).click();
  await expect(page).toHaveURL(/\/app\/homes\/[^/]+$/);
}

test("a shared home opens server posts with a text-only composer", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await openHome(page, /The Sunday home/);
  await expect(page.getByText("Alice's note")).toBeVisible();
  await expect(page.locator(".post")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Note", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Photo", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Voice", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Shared · Changes save automatically"),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("create, edit, move, removal, and Undo round-trip through the API", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openHome(page, /The Sunday home/);
  await expect(page.getByText("Alice's note")).toBeVisible();

  await page.getByRole("button", { name: "Note", exact: true }).click();
  await page.getByLabel("Your message").fill("Fresh from the test");
  await page.getByRole("button", { name: "Put on fridge" }).click();
  await expect(page.getByText("Fresh from the test")).toBeVisible();
  expect(lastBodies.create).toMatchObject({ text: "Fresh from the test" });

  await page.getByRole("button", { name: "Open Fresh from the test" }).click();
  await page.getByLabel("Your message").fill("Edited by the test");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Edited by the test")).toBeVisible();
  expect(lastBodies.edit).toMatchObject({ text: "Edited by the test" });
  expect(lastBodies.edit).not.toHaveProperty("x");

  const card = page.getByRole("button", { name: "Open Edited by the test" });
  await card.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => lastBodies.move as { x: number } | undefined)
    .toBeDefined();
  const moved = lastBodies.move as Record<string, number>;
  expect(Object.keys(moved).sort()).toEqual(["x", "y"]);
  expect(moved.x).toBeCloseTo(0.51, 2);

  await card.click();
  await page.getByRole("button", { name: "Remove from fridge" }).click();
  await expect(page.getByText("Removal pending · Undo")).toBeVisible();
  expect(lastBodies.removal).toEqual({ method: "POST" });
  await page
    .getByRole("button", { name: "Undo removal of Edited by the test" })
    .click();
  await expect(page.getByText("A little time to undo")).toBeVisible();
  await page.getByRole("button", { name: "Undo removal", exact: true }).click();
  await expect(page.getByText("Removal pending · Undo")).toHaveCount(0);
  expect(lastBodies.removal).toEqual({ method: "DELETE" });
  expect(errors).toEqual([]);
});

test("a poll shows another member's note without interaction", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await openHome(page, /The Sunday home/);
  await expect(page.getByText("Alice's note")).toBeVisible();
  expect(boardGets).toBe(1);

  boards[homeA].posts.push(
    mockPost(homeA, {
      id: "10000000-0000-4000-8000-000000000009",
      text: "Bob's poll note",
    }),
  );
  await expect.poll(() => boardGets, { timeout: 20_000 }).toBeGreaterThan(1);
  await expect(page.getByText("Bob's poll note")).toBeVisible();
});

test("a poll behind an open modal preserves the draft", async ({ page }) => {
  test.setTimeout(60_000);
  await openHome(page, /The Sunday home/);
  await expect(page.getByText("Alice's note")).toBeVisible();

  await page.getByRole("button", { name: "Open Alice's note" }).click();
  await page.getByLabel("Your message").fill("Draft in progress");
  const getsBefore = boardGets;
  boards[homeA].posts.push(
    mockPost(homeA, {
      id: "10000000-0000-4000-8000-000000000010",
      text: "Arriving during the draft",
    }),
  );
  await expect
    .poll(() => boardGets, { timeout: 20_000 })
    .toBeGreaterThan(getsBefore);
  await expect(page.getByLabel("Your message")).toHaveValue(
    "Draft in progress",
  );
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Draft in progress")).toBeVisible();
});

test("a failed save keeps the modal with its draft and error", async ({
  page,
}) => {
  await openHome(page, /The Sunday home/);
  await expect(page.getByText("Alice's note")).toBeVisible();

  await page.route("**/api/homes/*/posts/*", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 409,
        json: { error: "This post is greyed out for removal." },
      });
    } else {
      await route.fallback();
    }
  });
  await page.getByRole("button", { name: "Open Alice's note" }).click();
  await page.getByLabel("Your message").fill("Unsavable draft");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveText(
    "This post is greyed out for removal.",
  );
  await expect(page.getByLabel("Your message")).toHaveValue("Unsavable draft");
});

test("revoked membership shows the access-lost view with a way back", async ({
  page,
}) => {
  await openHome(page, /The Sunday home/);
  await expect(page.getByText("Alice's note")).toBeVisible();

  boardStatus = 404;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByText("You no longer have access to this home."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back to homes" }).click();
  await expect(page).toHaveURL(/\/app\/homes$/);
  await expect(
    page.getByRole("button", { name: /The Sunday home/ }),
  ).toBeVisible();
});

test("switching homes never shows the previous home's posts", async ({
  page,
}) => {
  await openHome(page, /The Sunday home/);
  await expect(page.getByText("Alice's note")).toBeVisible();

  await page.getByRole("button", { name: "Homes", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/homes$/);
  await page.getByRole("button", { name: /The little apartment/ }).click();
  await expect(page).toHaveURL(/\/app\/homes\/[^/]+$/);
  await expect(page.getByText("Beta home note")).toBeVisible();
  await expect(page.getByText("Alice's note")).toHaveCount(0);
});
