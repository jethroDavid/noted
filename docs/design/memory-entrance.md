# Noted login: memory entrance

Final login direction, 2026-10-03: a remembered Philippine sala with a handwritten invitation and a liquid entrance into the home.

## Art

The room uses a painted animation-background style with simpler planes, cool sage tiles, cream curtains, a familiar wooden chair and dining table, a calendar, window grills, and morning light. A passage through the back of the room gives the pull a visual destination. The login remains a bounded memory on an ivory page, with no foreground TV.

Artwork source: `docs/design/assets/morning-memory.png`.
Web asset: `apps/web/public/scene/sunday/morning-memory.webp` (1400px wide, approximately 140KB). Only the optimized image is served by the app. The renderer and fallback share this URL to avoid downloading a separate resized copy.

## Handwritten invitation

The app uses [Kalam](https://github.com/google/fonts/tree/main/ofl/kalam), a pen-like handwritten face. Regular and bold Latin WOFF2 files are bundled locally in `apps/web/src/styles/fonts` (about 44KB combined), with the font's OFL license. The web root loads it once and applies the shared `font-handwritten` theme token as the app default. The login uses comfortable reading sizes; other screens inherit the same family.

An ink underline and small morning sun connect the wordmark to the illustrated room. Faint paper grain softens the plain ivory surrounding the bounded memory. The centered Google button has an uneven paper contour, pencil lines, and the original Google mark on a white circle. Its outline flexes on hover or keyboard focus, settles with a small spring, and compresses on press. The label remains **Continue with Google**. All interactive layout and control styles stay in Tailwind; GSAP owns the decorative movement and cleans up its listeners and tweens. Reduced motion skips the ink drawing, entrance movement, and button animation.

## Motion

[GSAP with its React hook](https://gsap.com/resources/React/) owns the timeline and pointer response in the sign-in shell. A lazy React Three Fiber plane in the shared UI package renders the room through a GLSL shader. The package contains no auth or private data logic.

On first load, both memory layers are hidden. The image resolves, the lazy renderer initializes, and the shader renders its first transparent frame before reporting ready. Only then does the 2.6-second reveal start, so the first visible room already has its effects. The plain image is reserved for an actual unavailable/failed renderer; it fades in only after its own image has loaded. The invitation remains usable throughout loading.

At rest, a slowly moving noise field subtly distorts image coordinates and the soft boundary. Pointer position follows with inertia and a small image offset. The motion does not move the sign-in controls. The material gradually reveals spatially rather than sliding the whole picture into view.

After successful authentication, the 2.7-second timeline removes the interface, widens the memory aperture, and draws the image toward the room's central passage. The inward zoom is smaller so liquid movement dominates: a shifting noise field, uneven rotation, crossing waves, and radial stretching bend the room's geometry. A faint displaced image echo and color separation make details overlap like a half-recalled memory. Liquid displacement strengthens during the pull while the edges dissolve unevenly. The user prefers this stranger, more pronounced distortion to a steady zoom. Timeline completion opens the existing homes page; there is no arbitrary redirect timer.

The authenticated home UI is still the existing implementation. Continuity from this entrance into the three planned scenes is future scene work.

## Phone and accessibility behavior

- Responsive DOM sign-in with a 60px button; shader effects do not contain interactive content.
- Shared renderer uses [on-demand invalidation](https://r3f.docs.pmnd.rs/api/hooks), capped at 24fps on narrow screens and 30fps on wider screens. Pixel density is capped at 1.25.
- Hidden tabs do not request continuous shader redraws.
- Reduced-motion preference renders a still image and skips the inward transition.
- An image fallback covers unavailable WebGL, renderer failures, and lost GPU contexts. Navigation timing remains owned by the shell.
- GSAP contexts clean up timelines, ticker subscriptions, and pointer listeners when the component unmounts.

## Final generation prompt

Generated with the built-in image-generation tool. The selected source and its generation prompt are retained for future artwork changes.

```text
Use case: illustration-story
Asset type: background painting for a localized liquid-memory portal on Noted's sign-in page. New artwork, no UI.
Primary request: a cozy, ordinary Philippine family sala in the early 2000s, on a school-free Sunday morning, painted as an original traditional 2D cartoon background. It should feel like the quiet domestic establishing shot of a morning cartoon.
Style: animation background painting with simplified solid shapes, broad matte brush-painted color planes, softly shaded cel-like volumes, restrained paper texture, loose imperfect contour lines. Fresh and airy, not photorealistic, not watercolor, not elaborate Victorian furniture, not a vintage sepia filter, not a polished interior catalogue. No copying any existing show.
Scene: modest cream walls, cool pale sage and blue-green square tiled floor with perspective leading gently toward the center of the room; a tall sunlit window with simple iron grills and flowing light cream curtains at left; a simple wooden sala chair with a plain cushion near the left edge; familiar small wooden dining table and chairs on right, an unbranded illustrated calendar on the right wall with only indistinct marks. Light falls from the upper-left window across the tiles. A quiet open passage at the middle back suggests more home beyond, giving a clear feeling of depth.
Composition: wide landscape 1536x1024. Seated-eye-height, slightly spacious room with a central vanishing point. The middle 35 percent is calm and pale for readable sign-in content. The meaningful window and table/chair details sit within the middle 80 percent so they remain visible when the image edges dissolve into a soft oval mask. No foreground television, no kitchen appliances, no people. Keep details modest and familiar, not cluttered.
Palette: clean warm ivory, muted sage, powder blue shadows, honey wood, a little soft apricot sunlight. Sunlight is warm but the entire image must not be yellow or brown.
Constraints: no lettering, logos, watermark, panels or UI; background illustration only. Recognizable tiled floor, curtains, window grills, calendar, wooden chairs and table.
```
