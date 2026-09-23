// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Post } from "../state/board";
import type { BoardPostsSource } from "../state/posts-source";
import type { ThemeAssets } from "../../../types";
import { BoardApp } from "./board-app";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  window.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  window.HTMLElement.prototype.setPointerCapture = function () {};
  window.HTMLElement.prototype.releasePointerCapture = function () {};
  window.HTMLElement.prototype.hasPointerCapture = function () {
    return false;
  };
});

afterEach(() => cleanup());

const assets: ThemeAssets = {
  samplePhoto: { src: "/sample-photo.jpg", alt: "Sample photo" },
  sampleAudio: { src: "/sample-audio.mp3" },
};

function serverPost(overrides?: Partial<Post>): Post {
  return {
    id: "post-1",
    kind: "text",
    text: "Server note",
    x: 0.3,
    y: 0.4,
    background: "#f5dfa0",
    foreground: "#33352e",
    order: 0,
    removedAt: null,
    ...overrides,
  };
}

function makeSource(overrides?: Partial<BoardPostsSource>) {
  const source: BoardPostsSource = {
    posts: [serverPost()],
    loading: false,
    initialError: null,
    error: null,
    retry: vi.fn(),
    serverNow: () => Date.parse("2026-09-21T11:30:00.000Z"),
    save: vi.fn(async (post: Post) => post),
    move: vi.fn(async () => true),
    remove: vi.fn(async () => true),
    undo: vi.fn(async () => true),
    ...overrides,
  };
  return source;
}

describe("connected BoardApp", () => {
  it("renders server posts with a text-only composer and shared footer", () => {
    const rendered = render(
      <BoardApp
        assets={assets}
        homeName="The Sunday home"
        isPlayground={false}
        source={makeSource()}
        availableKinds={["text"]}
      />,
    );
    expect(rendered.getByText("Server note")).toBeTruthy();
    expect(rendered.queryByText(/Oat milk/)).toBeNull();
    expect(rendered.getByRole("button", { name: "Note" })).toBeTruthy();
    expect(rendered.queryByRole("button", { name: "Photo" })).toBeNull();
    expect(rendered.queryByRole("button", { name: "Voice" })).toBeNull();
    expect(
      rendered.getByText("Shared · Changes save automatically"),
    ).toBeTruthy();
  });

  it("shows loading and error states with a working retry", () => {
    const loading = render(
      <BoardApp assets={assets} source={makeSource({ loading: true })} />,
    );
    expect(loading.getByText("Loading your board…")).toBeTruthy();
    loading.unmount();

    const source = makeSource({ initialError: "The board couldn't load." });
    const failed = render(<BoardApp assets={assets} source={source} />);
    expect(failed.getByRole("alert").textContent).toMatch(
      "The board couldn't load.",
    );
    fireEvent.click(failed.getByRole("button", { name: "Try again" }));
    expect(source.retry).toHaveBeenCalledTimes(1);
  });

  it("keeps a modal draft when polled posts arrive behind it", () => {
    const rendered = render(
      <BoardApp
        assets={assets}
        isPlayground={false}
        source={makeSource()}
        availableKinds={["text"]}
      />,
    );
    fireEvent.click(rendered.getByRole("button", { name: "Open Server note" }));
    const editor = rendered.getByLabelText(
      "Your message",
    ) as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: "Edited draft" } });

    rendered.rerender(
      <BoardApp
        assets={assets}
        isPlayground={false}
        source={makeSource({
          posts: [serverPost({ text: "Changed behind the modal" })],
        })}
        availableKinds={["text"]}
      />,
    );
    expect(
      (rendered.getByLabelText("Your message") as HTMLTextAreaElement).value,
    ).toBe("Edited draft");
  });

  it("keeps the modal and draft when a save fails", async () => {
    const source = makeSource({
      save: vi.fn(async () => null),
      error: "This post is greyed out for removal.",
    });
    const rendered = render(
      <BoardApp
        assets={assets}
        isPlayground={false}
        source={source}
        availableKinds={["text"]}
      />,
    );
    fireEvent.click(rendered.getByRole("button", { name: "Open Server note" }));
    fireEvent.change(rendered.getByLabelText("Your message"), {
      target: { value: "My unsaved draft" },
    });
    await act(async () => {
      fireEvent.click(rendered.getByRole("button", { name: /Save note/ }));
    });
    await waitFor(() =>
      expect(rendered.getByRole("alert").textContent).toBe(
        "This post is greyed out for removal.",
      ),
    );
    expect(
      (rendered.getByLabelText("Your message") as HTMLTextAreaElement).value,
    ).toBe("My unsaved draft");
    expect(source.save).toHaveBeenCalledTimes(1);
  });

  it("previews a drag locally and commits once on release", async () => {
    const source = makeSource();
    const rendered = render(
      <BoardApp
        assets={assets}
        isPlayground={false}
        source={source}
        availableKinds={["text"]}
      />,
    );
    const card = rendered.getByRole("button", { name: "Open Server note" });
    const surface = card.parentElement as HTMLElement;
    surface.getBoundingClientRect = () =>
      ({
        width: 540,
        height: 870,
        left: 0,
        top: 0,
        right: 540,
        bottom: 870,
        x: 0,
        y: 0,
        toJSON: () => {},
      }) as DOMRect;
    const beforeX = Number(card.getAttribute("data-x"));

    fireEvent.pointerDown(card, {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(card, {
      pointerId: 1,
      clientX: 100 + 54,
      clientY: 100,
    });
    const previewX = Number(
      rendered
        .getByRole("button", { name: "Open Server note" })
        .getAttribute("data-x"),
    );
    expect(previewX).toBeGreaterThan(beforeX);
    expect(source.move).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.pointerUp(card, { pointerId: 1, clientX: 154, clientY: 100 });
    });
    expect(source.move).toHaveBeenCalledTimes(1);
    expect(source.move).toHaveBeenCalledWith(
      "post-1",
      expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    );
  });
});
