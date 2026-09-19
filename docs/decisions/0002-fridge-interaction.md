# Fridge interaction prototype

Date: 2026-09-16

## Presentation and runtime

Phase 2 adds a front-facing Three.js refrigerator using React Three Fiber. The body, doors, handles, and feet are local procedural geometry. No remote model, environment map, or runtime font request is needed. Lighting and the offset casing provide depth with a fixed camera. The scene renders on demand and caps device pixel ratio at 1.5.

The interactive cards are accessible HTML over the scene. This keeps native text, images, audio, focus, and pointer capture available without mapping every UI control into WebGL. The modal uses the browser's dialog top layer, explicit Tab wrapping, Escape, and focus restoration. A CSS fridge remains usable during loading and when WebGL2 or its context is unavailable. Reduced-motion preferences disable entrance and control animations.

React and React DOM are pinned to 19.2.8 because Fiber 9.7.0 declares a React peer range of `>=19 <19.3`. Next.js 16.3.5 accepts this version. This replaces the Phase 1 React 19.3 pins. Recheck the package peer ranges together when upgrading.

References: [Fiber installation](https://r3f.docs.pmnd.rs/getting-started/installation), [Canvas API](https://r3f.docs.pmnd.rs/api/canvas). The installed package's peer dependencies are the authority for the exact compatible versions.

## Coordinates and layers

The scene always occupies a 7:10 frame. Its orthographic zoom is the frame's pixel height divided by 10. The HTML board starts 10.5% from the left and 6.5% from the top, covering 77.1428571% of the width and 87% of the height. Its logical surface is 540 × 870 units. This expands placement from the small lower-door rectangle to almost the entire front, including the upper door and areas near the edges. Card dimensions remain at their original display scale; the fridge itself is not enlarged. Keep the CSS surface and logical dimensions synchronized.

Posts store normalized center coordinates. A drag's pixel delta is divided by the current surface width/height, then added to the starting position. Clamping includes half the post's width and height, so its full rectangle stays inside the surface. Card dimensions and text scale with that same frame. No movement value depends on device pixels or screen size.

The original page layout and fridge size are retained, with the posting toolbar below. Handles and decorative lettering do not block placement; posts can overlap them. The surface keeps a small inset from the outer silhouette so cards stay on the fridge.

Pointer movement of less than six CSS pixels is a tap. Beyond that, pointer capture follows the drag even outside the card. Release ends the drag without opening the editor; cancellation restores the initial position. Only the primary pointer is accepted. Touch scrolling stays available outside the cards. Arrow keys move by 0.01; Shift increases that to 0.05.

Creation order increases monotonically within the temporary session. Normal z-index is order + 1; selection uses the current maximum order + 2. Selection never rewrites creation order. Clicking the blank surface or pressing Escape on a focused card clears selection.

## Shared card and modal components

The shared frontend keeps presentation for each post kind in its own component:

```text
packages/fridge-ui/src/
  post-card.tsx                 Shared position, selection, drag, and keyboard behavior
  posts/
    index.tsx                  Selects the card component for a post kind
    text-post-card.tsx
    photo-post-card.tsx
    voice-post-card.tsx
  post-modal.tsx                Selects the modal component for a post kind
  modals/
    post-modal-frame.tsx        Shared dialog template and post actions
    text-post-modal.tsx         Message draft, validation, paper, and ink
    photo-post-modal.tsx        Photo preview
    voice-post-modal.tsx        Audio playback
```

Each modal composes `PostModalFrame` with its own content, title, submit callback, and optional save label/disabled state. The frame owns focus handling, scroll locking, backdrop/Escape dismissal, header, footer, removal countdown, and Undo. Draft state belongs to the editor that needs it. Card components similarly compose `PostCard` so dragging and selection stay consistent across kinds. New kinds should use these wrappers rather than duplicate those behaviors.

## Temporary data boundary

Posts live in component state and reset on a full refresh. There are no post API calls, browser database, identity simulation, or shared updates. Photo and voice creation insert bundled samples. Text creation and editing are functional. Actual uploads and recording remain Phase 6 work.

Removal uses the shared domain constant of exactly 3,600,000 milliseconds. Pending posts are greyed out and cannot be edited or moved; opening one exposes Undo and the remaining minutes. Expired posts disappear, and Undo rechecks the deadline at the click. This clock is browser-local for the prototype. Phase 5 must replace it with server-authoritative state and deadlines.

## Validation and remaining device review

Unit checks cover normalized movement across display sizes, complete card bounds, stable creation layers, and the exact removal deadline. Playwright covers mouse/touch movement, creation, modal editing and cancellation, keyboard controls and focus, image/audio playback, removal/Undo/expiry, small-screen layout, reload reset, and loss of WebGL support. Browser tests use a production build on port 3100, separate from development on port 3000.

Physical phone checks remain required: drag all three card types, tap versus drag, scroll outside cards, open and close modals with the virtual keyboard, and listen to the sample audio in Safari and/or Android Chrome. Automated touch emulation is evidence for event handling, not proof of real-device behavior. No microphone or sign-in is used in this phase.

Verification completed on 2026-09-17: `pnpm check` passed (formatting, lint, types, 12 unit tests, production build), and all 14 Playwright desktop/emulated-touch checks passed. Screenshots of desktop, phone, and the phone editor were visually reviewed. The local browser was cached Chromium 149.0.7827.55 with software rendering because downloading the Playwright-matched Chromium timed out. CI is configured to install the matching browser; its remote run has not been observed.
