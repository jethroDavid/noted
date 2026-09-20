import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("renders the illustrated fridge, fixtures, and working photo and audio", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const artwork = page.locator(".fridge-artwork");
  await expect(artwork).toBeVisible();
  await expect
    .poll(() =>
      artwork.evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
      ),
    )
    .toBe(true);
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Choose fridge model" }),
  ).toHaveCount(0);
  await expect(page.locator(".post")).toHaveCount(4);
  await page.locator(".fridge-stage").screenshot({
    path: testInfo.outputPath("fridge.png"),
    animations: "disabled",
  });
  await page.screenshot({
    path: testInfo.outputPath("kitchen.png"),
    fullPage: true,
    animations: "disabled",
  });
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

test("painted kitchen backdrop sits behind the interactive fridge", async ({
  page,
}) => {
  const backdrop = page.locator(".kitchen-backdrop");
  await expect(backdrop).toBeVisible();
  await expect(backdrop).toHaveAttribute("aria-hidden", "true");
  expect(
    await backdrop
      .locator("img")
      .evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
      ),
  ).toBe(true);
  const hitInsideFridge = await page.evaluate(() => {
    const stage = document.querySelector(".fridge-stage")!;
    const rect = stage.getBoundingClientRect();
    const hit = document.elementFromPoint(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
    );
    return Boolean(hit && stage.contains(hit));
  });
  expect(hitInsideFridge).toBe(true);
});

test("a failed fridge image falls back without blocking posts", async ({
  page,
}) => {
  await page.route("**/artwork/cream-fridge.webp", (route) => route.abort());
  await page.reload();
  await expect(page.locator(".fridge-flat-door")).toHaveCount(2);
  await expect(page.locator(".fridge-artwork")).toHaveCount(0);
  await page.getByRole("button", { name: "Note", exact: true }).click();
  await page.getByLabel("Your message").fill("Still at home");
  await page.getByRole("button", { name: "Put on fridge" }).click();
  await expect(
    page.getByRole("button", { name: "Open Still at home" }),
  ).toBeVisible();
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

test("all post kinds stay inside the painted doors at every corner", async ({
  page,
}, testInfo) => {
  const stage = (await page.locator(".fridge-stage").boundingBox())!;
  const ids = ["groceries", "weekend", "hello", "dinner"];
  const corners = [
    ["ArrowUp", "ArrowLeft"],
    ["ArrowUp", "ArrowRight"],
    ["ArrowDown", "ArrowRight"],
    ["ArrowDown", "ArrowLeft"],
  ];
  for (const [index, id] of ids.entries()) {
    const card = page.locator(`[data-post-id="${id}"]`);
    await card.focus();
    // Visit all corners; finish each card at a different one for visual review.
    for (let corner = 0; corner < 4; corner++) {
      const directions = corners[(corner + index + 1) % 4];
      for (let step = 0; step < 20; step++) {
        for (const direction of directions) {
          await page.keyboard.press(`Shift+${direction}`);
        }
      }
      const bounds = (await card.boundingBox())!;
      const frame = (await page.locator(".fridge-stage").boundingBox())!;
      // Independently measured safe envelope inside the artwork, not just the
      // old .board-surface box (which includes transparent and curved edges).
      expect(bounds.x).toBeGreaterThan(frame.x + frame.width * 0.16);
      expect(bounds.x + bounds.width).toBeLessThan(
        frame.x + frame.width * 0.85,
      );
      expect(bounds.y).toBeGreaterThan(frame.y + frame.height * 0.11);
      expect(bounds.y + bounds.height).toBeLessThan(
        frame.y + frame.height * 0.91,
      );
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  }
  // Bounds changes must not shrink the actual cards.
  const note = (await page
    .locator('[data-post-id="groceries"]')
    .boundingBox())!;
  expect(note.width / stage.width).toBeCloseTo(196 / 700, 2);
  await page.locator(".fridge-stage").screenshot({
    path: testInfo.outputPath("fridge-corners.png"),
    animations: "disabled",
  });
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
