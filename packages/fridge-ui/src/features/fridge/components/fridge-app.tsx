"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  clampPosition,
  createPost,
  fixturePosts,
  isExpired,
  type Post,
  type PostKind,
  type Position,
} from "../state/board";
import type { FridgePostsSource } from "../state/posts-source";
import { Icon } from "../../../ui/icons";
import { PostRenderer } from "./posts/index";
import { PostModal } from "./post-modal";
import { FridgeArtwork } from "./fridge-artwork";
import { FridgePlant } from "./fridge-plant";
import { getPlantStage } from "../state/plant-growth";
import type { FridgeAssets } from "../../../types";
import { BrandLink } from "../../../ui/brand-link";

const ALL_KINDS: PostKind[] = ["text", "photo", "voice"];
const COMPOSER_KINDS: {
  kind: PostKind;
  label: string;
  icon: "note" | "photo" | "voice";
}[] = [
  { kind: "text", label: "Note", icon: "note" },
  { kind: "photo", label: "Photo", icon: "photo" },
  { kind: "voice", label: "Voice", icon: "voice" },
];

export function FridgeApp({
  assets,
  homeName = "Playground",
  headerAction,
  overlay,
  notice,
  isPlayground = true,
  brandHref = "/",
  source,
  availableKinds = ALL_KINDS,
}: {
  assets: FridgeAssets;
  homeName?: string;
  headerAction?: ReactNode;
  overlay?: ReactNode;
  notice?: string | null;
  isPlayground?: boolean;
  brandHref?: string;
  source?: FridgePostsSource;
  availableKinds?: PostKind[];
}) {
  const connected = source !== undefined;
  const [localPosts, setLocalPosts] = useState<Post[]>(fixturePosts);
  const [localAdditions, setLocalAdditions] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ post: Post; isNew: boolean } | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [dragPreview, setDragPreview] = useState<{
    id: string;
    position: Position;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const dragPreviewRef = useRef(dragPreview);
  const savingRef = useRef(false);
  // The tick reads through a ref so the interval never resubscribes when the
  // source object identity changes.
  const tickRef = useRef(() => Date.now());
  useEffect(() => {
    tickRef.current = source ? source.serverNow : () => Date.now();
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(tickRef.current()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const storedPosts = source ? source.posts : localPosts;
  const posts =
    connected && dragPreview
      ? storedPosts.map((post) =>
          post.id === dragPreview.id
            ? { ...post, ...dragPreview.position }
            : post,
        )
      : storedPosts;
  const postAdditions = source ? source.postAdditions : localAdditions;
  const actionError =
    source && actionFailed
      ? (source.error ?? "Something went wrong. Try again.")
      : null;

  const visiblePosts = posts.filter((post) => !isExpired(post, now));
  const topOrder = Math.max(-1, ...posts.map((post) => post.order));

  function openEditor(post: Post, isNew: boolean) {
    setActionFailed(false);
    setEditor({ post, isNew });
  }

  function closeEditor() {
    setActionFailed(false);
    setEditor(null);
  }

  function add(kind: PostKind) {
    openEditor(createPost(kind, topOrder + 1), true);
  }

  function move(id: string, position: Position) {
    if (!source) {
      setLocalPosts((current) =>
        current.map((post) =>
          post.id === id && post.removedAt === null
            ? { ...post, ...clampPosition(position, post.kind) }
            : post,
        ),
      );
      return;
    }
    const target = source.posts.find((post) => post.id === id);
    if (!target || target.removedAt !== null) return;
    const preview = {
      id,
      position: clampPosition(position, target.kind),
    };
    dragPreviewRef.current = preview;
    setDragPreview(preview);
  }

  async function commitMove(id: string) {
    if (!source) return;
    const preview = dragPreviewRef.current;
    if (!preview || preview.id !== id) return;
    const moved = await source.move(id, preview.position);
    // A newer drag replaces the preview; only clear our own.
    if (dragPreviewRef.current === preview) {
      dragPreviewRef.current = null;
      setDragPreview(null);
    }
    if (!moved) setAnnouncement("Couldn't save that move. Try again.");
  }

  function cancelMove(id: string) {
    if (!source) return;
    if (dragPreviewRef.current?.id !== id) return;
    dragPreviewRef.current = null;
    setDragPreview(null);
  }

  async function save(post: Post) {
    if (!source) {
      if (editor?.isNew) setLocalAdditions((current) => current + 1);
      setLocalPosts((current) =>
        editor?.isNew
          ? [...current, post]
          : current.map((existing) =>
              existing.id === post.id && existing.removedAt === null
                ? post
                : existing,
            ),
      );
      setSelectedId(post.id);
      closeEditor();
      setAnnouncement("Your post is on the fridge.");
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await source.save(post, editor?.isNew ?? false);
      if (!saved) {
        setActionFailed(true);
        return;
      }
      setSelectedId(saved.id);
      closeEditor();
      setAnnouncement("Your post is on the fridge.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!source) {
      const removedAt = Date.now();
      setLocalPosts((current) =>
        current.map((post) =>
          post.id === id && post.removedAt === null
            ? { ...post, removedAt }
            : post,
        ),
      );
      setNow(removedAt);
      closeEditor();
      setAnnouncement("Post greyed out for one hour. Open it to undo removal.");
      return;
    }
    const removed = await source.remove(id);
    if (!removed) {
      setActionFailed(true);
      return;
    }
    setNow(source.serverNow());
    closeEditor();
    setAnnouncement("Post greyed out for one hour. Open it to undo removal.");
  }

  async function undo(id: string) {
    if (!source) {
      const currentTime = Date.now();
      const target = localPosts.find((post) => post.id === id);
      if (!target || isExpired(target, currentTime)) {
        setNow(currentTime);
        closeEditor();
        setAnnouncement("The one-hour Undo period has ended.");
        return;
      }
      setLocalPosts((current) =>
        current.map((post) =>
          post.id === id && !isExpired(post, currentTime)
            ? { ...post, removedAt: null }
            : post,
        ),
      );
      setNow(currentTime);
      closeEditor();
      setAnnouncement("Post restored to the fridge.");
      return;
    }
    const restored = await source.undo(id);
    if (!restored) {
      setActionFailed(true);
      return;
    }
    setNow(source.serverNow());
    closeEditor();
    setAnnouncement("Post restored to the fridge.");
  }

  const footerNote = connected
    ? "Shared · Changes save automatically"
    : isPlayground
      ? "Playground · Changes reset on refresh"
      : "Preview · Your posts reset on refresh";
  const helpPersistenceNote = connected
    ? "Changes save to your shared home."
    : "Posts reset when you refresh this preview.";

  return (
    <div className="noted-app app-shell">
      <header className="app-header">
        <BrandLink href={brandHref} />
        <span className="home-label" title={homeName}>
          <Icon name="home" size={17} /> <span>{homeName}</span>
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
      {source?.loading ? (
        <main className="kitchen">
          <p className="fridge-status" role="status">
            Loading your fridge…
          </p>
        </main>
      ) : source?.initialError ? (
        <main className="kitchen">
          <div className="fridge-status" role="alert">
            <p>{source.initialError}</p>
            <button
              type="button"
              className="primary-button"
              onClick={source.retry}
            >
              Try again
            </button>
          </div>
        </main>
      ) : (
        <main className="kitchen">
          {assets.kitchenBackdrop && (
            <div className="kitchen-backdrop" aria-hidden="true">
              <img
                src={assets.kitchenBackdrop.src}
                width={1536}
                height={1024}
                alt=""
                draggable={false}
              />
            </div>
          )}
          <section className="workspace-heading" aria-labelledby="page-title">
            <p className="eyebrow">{isPlayground ? "" : homeName}</p>
            <h1 id="page-title">
              On the fridge<span>.</span>
            </h1>
            <p>
              {isPlayground
                ? "Try a note. Move a memory. Make yourself at home."
                : "The everyday stuff, all together."}
            </p>
            <div className="post-count">
              <span />
              {visiblePosts.length} little things
            </div>
          </section>
          <div className="fridge-column">
            <div className="workspace-bottom">
              <p className="interaction-hint" id="board-instructions">
                <span className="sr-only">
                  . With keyboard focus, use arrow keys to move a post, Shift
                  for larger steps, and Enter to open.
                </span>
              </p>
              <div
                className="composer"
                role="group"
                aria-label="Add to the fridge"
              >
                {COMPOSER_KINDS.filter((entry) =>
                  availableKinds.includes(entry.kind),
                ).map((entry) => (
                  <button
                    key={entry.kind}
                    onClick={() => add(entry.kind)}
                    aria-label={entry.label}
                    title={entry.label}
                  >
                    <span className={`tool-icon tool-icon--${entry.icon}`}>
                      <Icon name={entry.icon} />
                    </span>
                    <span className="composer-button-label">{entry.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="fridge-stage" aria-label="Family refrigerator">
              <div className="fridge-shadow" aria-hidden="true" />
              <FridgeArtwork artwork={assets.fridgeArtwork} />
              <FridgePlant
                artwork={assets.plantArtwork}
                stage={getPlantStage(postAdditions)}
              />
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
                    commitMove={connected ? commitMove : undefined}
                    cancelMove={connected ? cancelMove : undefined}
                    open={(selected) => openEditor(selected, false)}
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
        </main>
      )}
      <footer className="app-footer">
        <span></span>
        <span>{footerNote}</span>
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
            Removed posts stay grey for one hour. Open one to undo.{" "}
            {helpPersistenceNote}
          </p>
          <button className="text-button" onClick={() => setShowHelp(false)}>
            Got it
          </button>
        </aside>
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
          onClose={() => closeEditor()}
          onSave={save}
          onRemove={remove}
          onUndo={undo}
          saving={connected ? saving : false}
          actionError={actionError}
        />
      )}
      {overlay}
    </div>
  );
}
