# Fridge illustration

Noted uses a softly painted cream refrigerator over a separate illustrated kitchen background. The direction follows the user's supplied reference: warm gouache texture, softly rounded enamel, olive-and-brass handles, gentle highlights, and a trailing plant. The fridge faces straight forward, with no visible side/back panel or perspective extrusion. The goal is a cohesive, detailed illustration with real interactive posts above it.

## Artwork and ownership

- `apps/web/public/artwork/sunlit-kitchen.webp`: kitchen without a fridge, interface text, or posts.
- `apps/web/public/artwork/cream-fridge.webp`: isolated bare fridge with a genuine transparent background and empty doors.
- `apps/web/public/artwork/plants/`: small, growing, lush, and overgrown transparent plant sprites. [Plant prompts and registration](../../apps/web/public/artwork/plants/README.md).
- [Artwork prompts](../../apps/web/public/artwork/README.md): exact generation prompts, output dimensions, and export details.
- [assets.ts](../../apps/web/src/features/fridge/assets.ts): the web shell supplies asset paths through `FridgeAssets`.
- [fridge-artwork.tsx](../../packages/fridge-ui/src/features/fridge/components/fridge-artwork.tsx): platform-neutral image renderer. Uses the original `FlatFridge` SVG if its asset is missing or fails to load.
- [styles.css](../../packages/fridge-ui/src/styles.css): background fade/crop, image alignment, HTML decorations, and the interactive post surface.

The image files were made with the built-in image-generation tool and exported as WebP without changing their dimensions. The fridge and plants preserve alpha. Their combined transfer size is approximately 718 KiB.

## Visual rules

Keep kitchen and fridge in the same warm cream, muted sage, soft brass, and blush palette. Preserve the painted highlights and subtle texture; do not flatten the illustration into thick vector outlines. Keep the background softer than the fridge and maintain readable page text.

Do not bake notes, photos, voice cards, lettering, logos, or interface controls into the artwork. Those remain HTML, independently editable and accessible. Existing decorative lettering and stickers also remain separate. The plant must stay separate from the fridge so its growth stage can change independently.

The kitchen can crop on smaller screens; the complete fridge must remain visible. Mask the kitchen into the page background, keeping it clear of the header. The illustration and post surface scale together. No WebGL or runtime 3D is required.

## Coordinates

The stage retains its 7:10 aspect ratio. The fridge image has transparent margins, so CSS places it at left -2.5%, top -1.5%, width 112%, height 106% of that stage. These values are specific to the current generated artwork: review the door bounds before replacing the image with another composition.

The HTML surface stays at left 10.5%, top 6.5%, width 77.1428571%, height 87%, using 540 x 870 logical units. This preserves card display sizes and typography. Movement is inset within that surface by 46 units on the left, 26 on the right, 55 at the top, and 35 at the bottom (`BOARD_INSETS` in `board.ts`). Every card's full dimensions are clamped inside this safe area, including clearance for magnets, tape, shadows, and the curved door corners. This maps to approximately 17.1%-83.9% horizontally and 12%-90% vertically in the stage.

Do not use the transparent image bounds or the complete HTML surface as the usable door boundary. Verify cards at all four corners against the actual artwork whenever it changes. Keep handles and decorations non-interactive beneath the posts. Desktop stage width is up to 480px (narrower on short viewports); mobile remains up to 400px.

## Plant growth

The plant grows with activity: only saving a new note, photo, or voice post adds one point. It starts small, becomes growing at 4 additions, lush at 8, and overgrown at 12. Milestones live together in `plant-growth.ts`. Growth is retained when posts are edited, moved, greyed out, restored, or expire. No inactivity decay is currently applied. Fixtures do not count, and preview growth resets on refresh alongside preview posts.

`FridgePlant` layers four images at the same pot anchor and crossfades the active one over 300ms. Reduced motion disables transitions. The layer is hidden from assistive technology and ignores pointer events. Keep it below the interactive posts. CSS positions it at left -2.5%, top -9%, width 112%, height 106% of the stage; extra space above the stage accommodates the foliage. Preserve each sprite's transparent padding when replacing artwork.

On narrow screens the plant layer uses 104% width to keep the vines within the viewport. The add-post controls sit above the plant where their layers overlap, preserving readable labels.

The small sprite has a slightly higher pot within its canvas. Its image alone is translated down by 0.6% of its height so the pot rests on the fridge rim. Keep this correction on the individual image, including during crossfades; the other stages retain their original placement.

## Verification

Run `pnpm check` and `pnpm test:browser`. Review desktop and touch screenshots of the whole kitchen as well as the fridge. Browser checks verify loaded artwork, the absence of a canvas, image-load failure fallback, every post kind at the surface edges, keyboard/touch movement, editing, and removal/Undo.

The retired Three.js preview modules and dependencies were deleted; see [the flat-render decision](../decisions/0004-flat-fridge-render.md) for the history. Interface icons follow [the icon guidelines](./icons.md).
