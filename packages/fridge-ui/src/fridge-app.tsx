"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  clampPosition,
  createPost,
  fixturePosts,
  isExpired,
  type Post,
  type PostKind,
  type Position,
} from "./board";
import { Icon } from "./icons";
import { PostRenderer } from "./posts";
import { PostModal } from "./post-modal";
import FridgeScene from "./fridge-scene";
import type { FridgeAssets } from "./types";
import {
  DEFAULT_FRIDGE_MODEL,
  FRIDGE_MODELS,
  type FridgeModelId,
} from "./models";
import { ModelPicker } from "./model-picker";

export function FridgeApp({
  assets,
  homeName = "Playground",
  headerAction,
  notice,
  isPlayground = true,
  brandHref = "/",
}: {
  assets: FridgeAssets;
  homeName?: string;
  headerAction?: ReactNode;
  notice?: string | null;
  isPlayground?: boolean;
  brandHref?: string;
}) {
  const [posts, setPosts] = useState<Post[]>(fixturePosts);
  const [modelId, setModelId] = useState<FridgeModelId>(DEFAULT_FRIDGE_MODEL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ post: Post; isNew: boolean } | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [sceneUnavailable, setSceneUnavailable] = useState(false);
  const onUnavailable = useCallback(() => setSceneUnavailable(true), []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const visiblePosts = posts.filter((post) => !isExpired(post, now));
  const topOrder = Math.max(-1, ...posts.map((post) => post.order));

  function add(kind: PostKind) {
    setEditor({ post: createPost(kind, topOrder + 1), isNew: true });
  }

  function move(id: string, position: Position) {
    setPosts((current) =>
      current.map((post) =>
        post.id === id && post.removedAt === null
          ? { ...post, ...clampPosition(position, post.kind) }
          : post,
      ),
    );
  }

  function save(post: Post) {
    setPosts((current) =>
      editor?.isNew
        ? [...current, post]
        : current.map((existing) =>
            existing.id === post.id && existing.removedAt === null
              ? post
              : existing,
          ),
    );
    setSelectedId(post.id);
    setEditor(null);
    setAnnouncement("Your post is on the fridge.");
  }
  function remove(id: string) {
    const removedAt = Date.now();
    setPosts((current) =>
      current.map((post) =>
        post.id === id && post.removedAt === null
          ? { ...post, removedAt }
          : post,
      ),
    );
    setNow(removedAt);
    setEditor(null);
    setAnnouncement("Post greyed out for one hour. Open it to undo removal.");
  }
  function undo(id: string) {
    const currentTime = Date.now();
    const target = posts.find((post) => post.id === id);
    if (!target || isExpired(target, currentTime)) {
      setNow(currentTime);
      setEditor(null);
      setAnnouncement("The one-hour Undo period has ended.");
      return;
    }
    setPosts((current) =>
      current.map((post) =>
        post.id === id && !isExpired(post, currentTime)
          ? { ...post, removedAt: null }
          : post,
      ),
    );
    setNow(currentTime);
    setEditor(null);
    setAnnouncement("Post restored to the fridge.");
  }
  return (
    <div className="noted-app app-shell">
      <header className="app-header">
        <a className="wordmark" href={brandHref} aria-label="Noted home">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          noted<span className="brand-dot">.</span>
        </a>
        <span className="home-label">
          <Icon name="home" size={17} /> {homeName}
        </span>
        {headerAction && (
          <div className="app-header-action">{headerAction}</div>
        )}
        <button
          className="icon-button help-button"
          aria-label={showHelp ? "Hide fridge help" : "Show fridge help"}
          aria-expanded={showHelp}
          onClick={() => setShowHelp(!showHelp)}
        >
          <Icon name="help" />
        </button>
      </header>
      {notice && (
        <p className="app-notice" role="alert">
          {notice}
        </p>
      )}
      <main className="kitchen">
        <section className="workspace-heading" aria-labelledby="page-title">
          <p className="eyebrow">
            {isPlayground ? "Try the fridge" : "Our shared space"}
          </p>
          <h1 id="page-title">
            On the fridge<span>.</span>
          </h1>
          <p>The everyday stuff, all together.</p>
          <div className="post-count">
            <span />
            {visiblePosts.length} little things
          </div>
        </section>
        <div
          className="fridge-stage"
          aria-label="Family refrigerator"
          data-model={modelId}
        >
          <ModelPicker
            value={modelId}
            onChange={(next) => {
              setModelId(next);
              setAnnouncement(`${FRIDGE_MODELS[next].name} selected.`);
            }}
          />
          <div className="fridge-shadow" aria-hidden="true" />
          <div className="fridge-fallback" aria-hidden="true">
            <div />
            <i />
            <i />
          </div>
          {!sceneUnavailable && (
            <div className="fridge-canvas" aria-hidden="true">
              <FridgeScene modelId={modelId} onUnavailable={onUnavailable} />
            </div>
          )}
          <div className="freezer-decoration" aria-hidden="true">
            <span className="fridge-name">the good stuff</span>
            <span className="little-star">✳</span>
            <span className="freezer-sticker">
              home
              <br />
              <b>sweet</b>
              <br />
              home
            </span>
          </div>
          <section
            className="board-surface"
            aria-label="Fridge posts"
            onClick={(event) => {
              if (event.target === event.currentTarget) setSelectedId(null);
            }}
          >
            {visiblePosts.map((post) => (
              <PostRenderer
                key={post.id}
                photo={assets.samplePhoto}
                post={post}
                selectedId={selectedId}
                topOrder={topOrder}
                select={setSelectedId}
                move={move}
                open={(selected) => setEditor({ post: selected, isNew: false })}
              />
            ))}
            {visiblePosts.length === 0 && (
              <p className="empty-fridge">
                A little space for something good.
                <br />
                Add the first note.
              </p>
            )}
          </section>
          <span className="fridge-badge" aria-hidden="true">
            NOTED
          </span>
        </div>
        <aside className="workspace-aside">
          <span className="handwritten-arrow" aria-hidden="true">
            ↙
          </span>
          <p>
            A note. A memory.
            <br />A little hello.
          </p>
          <span>Make yourself at home.</span>
        </aside>
        <div className="workspace-bottom">
          <p className="interaction-hint" id="board-instructions">
            Drag to rearrange · Tap to open
            <span className="sr-only">
              . With keyboard focus, use arrow keys to move a post, Shift for
              larger steps, and Enter to open.
            </span>
          </p>
          <div className="composer" role="group" aria-label="Add to the fridge">
            <span className="composer-label">Leave a little something</span>
            <button onClick={() => add("text")}>
              <span className="tool-icon tool-icon--note">
                <Icon name="note" />
              </span>
              Note
              <Icon name="plus" size={14} />
            </button>
            <button onClick={() => add("photo")}>
              <span className="tool-icon tool-icon--photo">
                <Icon name="photo" />
              </span>
              Photo
              <Icon name="plus" size={14} />
            </button>
            <button onClick={() => add("voice")}>
              <span className="tool-icon tool-icon--voice">
                <Icon name="voice" />
              </span>
              Voice
              <Icon name="plus" size={14} />
            </button>
          </div>
        </div>
      </main>
      <footer className="app-footer">
        <span>
          <i /> A little space for your people.
        </span>
        <span>
          {isPlayground
            ? "Playground · Changes reset on refresh"
            : "Home preview · Posts reset on refresh until Phase 5"}
        </span>
      </footer>
      {showHelp && (
        <aside className="help-panel" aria-label="Fridge help">
          <h2>Make it yours</h2>
          <p>
            Drag a post to move it. Tap or click to open it. Use the Note button
            to add a message.
          </p>
          <p>
            Keyboard: Tab to a post, arrow keys to move, Enter to open, Escape
            to close.
          </p>
          <p>
            Removed posts stay grey for one hour. Open one to undo. Posts reset
            when you refresh this preview.
          </p>
          {sceneUnavailable && (
            <p>
              The 3D view is unavailable here. Your fridge still works in the
              simple view.
            </p>
          )}
          <button className="text-button" onClick={() => setShowHelp(false)}>
            Got it
          </button>
        </aside>
      )}
      {sceneUnavailable && (
        <p className="fallback-notice" role="status">
          Simple fridge view · 3D is unavailable in this browser
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {editor && (
        <PostModal
          key={editor.post.id}
          assets={assets}
          post={editor.post}
          isNew={editor.isNew}
          now={now}
          onClose={() => setEditor(null)}
          onSave={save}
          onRemove={remove}
          onUndo={undo}
        />
      )}
    </div>
  );
}
