import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("renders the 3D fridge, fixtures, and working photo and audio", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".post")).toHaveCount(4);
  await page.getByRole("button", { name: "Open Mountain lake photo" }).click();
  await expect(page.locator(".photo-preview img")).toBeVisible();
  expect(
    await page
      .locator(".photo-preview img")
      .evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
      ),
  ).toBe(true);
  await page.getByRole("button", { name: "Close editor" }).click();
  await page
    .getByRole("button", { name: "Open Voice message", exact: true })
    .click();
  const audio = page.locator("audio");
  await expect
    .poll(() =>
      audio.evaluate((element: HTMLAudioElement) => element.readyState),
    )
    .toBeGreaterThan(0);
  await audio.evaluate((element: HTMLAudioElement) => element.play());
  await expect
    .poll(() =>
      audio.evaluate((element: HTMLAudioElement) => element.currentTime),
    )
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("creates and edits notes, cancels a draft, and resets on reload", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Note", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Put on fridge" }),
  ).toBeDisabled();
  await page.getByLabel("Your message").fill("Meet in the kitchen!");
  await page.getByRole("button", { name: "Rose paper" }).click();
  await page.getByRole("button", { name: "Berry ink" }).click();
  await page.getByRole("button", { name: "Put on fridge" }).click();
  const note = page.getByRole("button", {
    name: "Open Meet in the kitchen!",
    exact: true,
  });
  await expect(note).toHaveCSS("background-color", "rgb(239, 202, 195)");
  await expect(note).toHaveAttribute("data-order", "4");
  await note.click();
  await page.getByLabel("Your message").fill("Unsaved change");
  await page.getByRole("button", { name: "Close editor" }).click();
  await expect(note).toBeVisible();
  await note.click();
  await page.getByLabel("Your message").fill("Dinner is ready");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(
    page.getByRole("button", { name: "Open Dinner is ready" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".post")).toHaveCount(4);
});

test("keyboard movement, local selection, modal focus, and Escape", async ({
  page,
}) => {
  const note = page.locator('[data-post-id="groceries"]');
  await note.focus();
  await page.keyboard.press("ArrowRight");
  await expect(note).toHaveAttribute("data-x", "0.34");
  await expect(note).toHaveAttribute("data-order", "0");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        document.querySelector("dialog")?.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(note).toBeFocused();
});

test("grey removal disables movement, supports Undo, and expires at one hour", async ({
  page,
}) => {
  await page.clock.install();
  const note = page.locator('[data-post-id="groceries"]');
  await note.click();
  await page.getByRole("button", { name: "Remove from fridge" }).click();
  await expect(note).toHaveClass(/post--pending/);
  await note.focus();
  await page.keyboard.press("ArrowRight");
  await expect(note).toHaveAttribute("data-x", "0.33");
  await note.click();
  await expect(page.getByLabel("Your message")).toBeDisabled();
  await page.getByRole("button", { name: "Undo removal", exact: true }).click();
  await expect(note).not.toHaveClass(/post--pending/);
  await note.click();
  await page.getByRole("button", { name: "Remove from fridge" }).click();
  await page.clock.fastForward(3_599_000);
  await expect(note).toBeVisible();
  await note.click();
  await page.clock.fastForward(1000);
  await expect(
    page.getByRole("heading", { name: "This post has been removed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Undo removal", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(note).toHaveCount(0);
});

test("mouse or touch drag is bounded and does not open the editor", async ({
  page,
  context,
  isMobile,
}) => {
  const note = page.locator('[data-post-id="groceries"]');
  await note.scrollIntoViewIfNeeded();
  const box = (await note.boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  if (isMobile) {
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ ...start, id: 1 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: start.x + 60, y: start.y + 70, id: 1 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 60, start.y + 70, { steps: 8 });
    await page.mouse.up();
  }
  await expect(note).not.toHaveAttribute("data-x", "0.33");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await note.focus();
  for (let i = 0; i < 30; i++) await page.keyboard.press("Shift+ArrowRight");
  const surface = (await page.locator(".board-surface").boundingBox())!;
  const moved = (await note.boundingBox())!;
  expect(moved.x + moved.width).toBeLessThanOrEqual(
    surface.x + surface.width + 1,
  );
});

test("small-screen editor and fixture creation remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.getByRole("button", { name: "Note", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Put on fridge" }),
  ).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  for (const type of ["Photo", "Voice"]) {
    await page.getByRole("button", { name: type, exact: true }).click();
    await page.getByRole("button", { name: "Put on fridge" }).click();
  }
  await expect(page.locator(".post")).toHaveCount(6);
});

test("fridge stays usable when WebGL is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      ...args: unknown[]
    ) {
      if (type.startsWith("webgl")) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.reload();
  await expect(
    page.getByText("Simple fridge view · 3D is unavailable in this browser"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Choose fridge model" }).click();
  await page.getByRole("button", { name: "Butter retro", exact: true }).click();
  await expect(page.locator(".fridge-fallback")).toHaveCSS(
    "background-color",
    "rgb(244, 223, 172)",
  );
  await page.getByRole("button", { name: "Note", exact: true }).click();
  await page.getByLabel("Your message").fill("Still works");
  await page.getByRole("button", { name: "Put on fridge" }).click();
  await expect(
    page.getByRole("button", { name: "Open Still works" }),
  ).toBeVisible();
});

test("switches all fridge models without resetting notes or their positions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const note = page.locator('[data-post-id="groceries"]');
  await note.focus();
  await page.keyboard.press("ArrowRight");
  await note.click();
  await page.getByLabel("Your message").fill("Keep this on every fridge");
  await page.getByRole("button", { name: "Save note" }).click();
  const trigger = page.getByRole("button", { name: "Choose fridge model" });
  for (const [name, id] of [
    ["Butter retro", "retro"],
    ["Blue duo", "duo"],
    ["Sage classic", "classic"],
  ]) {
    await trigger.click();
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator(".fridge-stage")).toHaveAttribute(
      "data-model",
      id,
    );
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(note).toHaveAttribute("data-x", "0.34");
    await expect(note).toHaveAttribute("data-order", "0");
    await expect(note).toContainText("Keep this on every fridge");
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.locator(".post")).toHaveCount(4);
  }
  expect(errors).toEqual([]);
});

test("model chooser fits small screens and supports keyboard and outside dismissal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const trigger = page.getByRole("button", { name: "Choose fridge model" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const current = page.getByRole("button", {
    name: "Sage classic",
    exact: true,
  });
  await expect(current).toBeFocused();
  await expect(current).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Blue duo", exact: true }),
  ).toBeInViewport();
  const panel = (await page.locator(".model-picker-panel").boundingBox())!;
  expect(panel.x).toBeGreaterThanOrEqual(0);
  expect(panel.x + panel.width).toBeLessThanOrEqual(360);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await page.getByRole("heading", { name: "On the fridge." }).click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("all post kinds can reach the upper door and outer edges on every model", async ({
  page,
}) => {
  const stage = (await page.locator(".fridge-stage").boundingBox())!;
  const surface = (await page.locator(".board-surface").boundingBox())!;
  // The surface extends well above and beyond the former lower-door rectangle.
  expect(surface.y - stage.y).toBeLessThan(stage.height * 0.08);
  expect(surface.height).toBeGreaterThan(stage.height * 0.85);
  expect(surface.width).toBeGreaterThan(stage.width * 0.75);
  const models = ["Sage classic", "Butter retro", "Blue duo"];
  const ids = ["groceries", "weekend", "hello"];
  for (let i = 0; i < models.length; i++) {
    await page.getByRole("button", { name: "Choose fridge model" }).click();
    await page.getByRole("button", { name: models[i], exact: true }).click();
    const card = page.locator('[data-post-id="' + ids[i] + '"]');
    await card.focus();
    for (let step = 0; step < 20; step++) {
      await page.keyboard.press("Shift+ArrowUp");
      await page.keyboard.press("Shift+ArrowLeft");
    }
    const upper = (await card.boundingBox())!;
    const bounds = (await page.locator(".board-surface").boundingBox())!;
    expect(Math.abs(upper.x - bounds.x)).toBeLessThan(1);
    expect(Math.abs(upper.y - bounds.y)).toBeLessThan(1);
    for (let step = 0; step < 20; step++) {
      await page.keyboard.press("Shift+ArrowDown");
      await page.keyboard.press("Shift+ArrowRight");
    }
    const lower = (await card.boundingBox())!;
    const after = (await page.locator(".board-surface").boundingBox())!;
    expect(
      Math.abs(lower.x + lower.width - after.x - after.width),
    ).toBeLessThan(1);
    expect(
      Math.abs(lower.y + lower.height - after.y - after.height),
    ).toBeLessThan(1);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

for (const [kind, id, title] of [
  ["Photo", "weekend", "A moment to keep"],
  ["Voice", "hello", "A familiar voice"],
]) {
  test(`${kind} modal shares cancellation, focus restoration, removal and Undo`, async ({
    page,
  }) => {
    await page.getByRole("button", { name: kind, exact: true }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.locator(".post")).toHaveCount(4);
    const card = page.locator(`[data-post-id="${id}"]`);
    await card.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: title })).toBeVisible();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(card).toBeFocused();
    await card.click();
    await page.getByRole("button", { name: "Remove from fridge" }).click();
    await expect(card).toHaveClass(/post--pending/);
    await card.click();
    await expect(
      page.getByRole("button", { name: "Done", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Undo removal", exact: true })
      .click();
    await expect(card).not.toHaveClass(/post--pending/);
  });
}
