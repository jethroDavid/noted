# Noted brand variants — v1

Generated with the built-in imagegen tool on October 3, 2026, using the approved [folded-paper N](../../apps/web/public/brand/noted-icon-v1.png) as the identity reference. The user requested a handwritten Noted wordmark alongside the brand icon.

## Deliverables

- [Compact app/page icon](../../apps/web/public/brand/noted-app-icon-v1.png): warm cream N and sage magnet against a simpler blue background, with less texture for small display sizes.
- [Transparent brand logo](../../apps/web/public/brand/noted-brand-lockup-v1.png): blue folded N and sage magnet, beside the handwritten word Noted in dark green, intended for a light cream page/header.

These are full-resolution design masters. The original illustrated icon remains available. The generated lettering is an illustrated wordmark; it is not the app's actual bundled Kalam font.

## App integration

The login and homes chooser use `public/brand/noted-logo.webp` through `features/brand/noted-logo.tsx`. This transparent 900×266 export removes empty outer padding and preserves the approved artwork. Existing login entrance and transition motion still surround the logo.

Root app metadata files `icon1.png` (32px), `icon2.png` (48px), and `apple-icon.png` (180px) are resized exports of the compact icon. Next adds the browser and Apple touch icon links on every page. Individual homes keep their compact home-name header.

## Sources

- App icon: `C:/Users/jethr/.codex/generated_images/01a0ff18-5224-7c31-b30e-d7b3a46a27a1/exec-3af503df-5fe0-4182-88eb-bfe77e8445d9.png`
- Brand logo: `C:/Users/jethr/.codex/generated_images/01a0ff18-5224-7c31-b30e-d7b3a46a27a1/exec-cfacf22b-a810-445c-acc2-0d1ee7256f20.png`

## Exact app icon prompt

```text
Use case: logo-brand.
Asset type: one square small-size app / browser page icon for Noted.
Reference role: the attached image is the selected identity, a folded-paper cream N pinned by one sage magnet on dusty blue. Preserve the identity and recognizable broad N fold geometry.
Request: create a SMALL-SIZE OPTIMIZED variation of this icon, designed to remain legible at 16, 32 and 64 pixels. This should be simpler and calmer than the textured original, while still looking warm and handcrafted.
Composition: one centered, large, bold folded-paper capital N with its two upright strips and diagonal connecting folded strip. One sage-green circular magnet pins the upper portion of the right upright. N occupies approximately 76 percent of the square. Keep balanced safe margins. Use broad folds and thick strips, generous open triangular negative spaces. Keep the magnet clear but subordinate to the letter.
Background: solid muted dusty blue extending all the way to every edge of the square. NO rounded-square outer container, NO outer white margin.
Style: clean hand-cut paper illustration with softly imperfect edges. Warm ivory paper, two or three flat warm shadow tones to explain the folds, a minimal muted edge shadow, sage magnet with one quiet highlight. Very restrained grain only; remove the noisy fibers, scattered scratches and embossed texture of the reference. Maintain the cozy old family-fridge feeling; do not turn it into a glossy plastic or corporate gradient icon.
Constraints: exactly one N emblem with one magnet, no lettering, labels, wordmark, numeral, board, grid, extra objects, scenery or watermark. Preserve the original N silhouette and magnet relationship. No photorealistic texture, dramatic shadows, excessive grunge or fine linework. Strong cream-on-blue contrast.
```

## Exact brand logo prompt

```text
Use case: logo-brand.
Asset type: one horizontal transparent-background brand logo lockup for Noted, suitable for a cream website header.
Reference role: the attached selected icon establishes the identity: a folded-paper capital N with a sage-green magnet attached to the upper part of its right upright. Keep the same recognizable N silhouette and the same single magnet relationship.
Primary request: make a lighter, SIMPLER brand-logo version of that mark, with the handwritten name Noted beside it. The background must be genuinely transparent, not white, cream or a checkerboard.
Composition: wide horizontal canvas, approximately 3:1 aspect ratio. On the left, a compact folded-paper N emblem. To its right, generous but controlled spacing and the word Noted. The emblem and lettering align visually along a shared baseline and are balanced in height; the emblem is a little taller than the lettering. The complete lockup is centered with modest transparent safe padding and no excessive empty space.
Mark adaptation: recolor the N paper to muted dusty blue so it contrasts clearly against a light cream page. Use two or three simple blue paper tones with soft folds and a tiny ivory fold highlight. Keep the round sage magnet, simplified and modestly sized. The overall silhouette and broad folds must match the reference. Remove dense fibers, tiny scratches, heavy drop shadows and photographic embossed detail. It should still feel like hand-cut folded paper, not printed type.
Text (verbatim): "Noted". Spell N-o-t-e-d, exactly. Capital N followed by lowercase oted. Readable warm handwritten ink lettering in the spirit of Kalam: relaxed slightly forward-leaning strokes, clear letterforms, short restrained ascenders and natural hand rhythm. Dark muted green/slate ink. No formal calligraphy, long swashes, excessive loops, cartoon bubble letters, ornamental underlines or quotation marks.
Style: quiet handcrafted nostalgic family-home branding, soft paper color, subtly imperfect edges, restrained depth and barely visible texture. Positive and welcoming, visually related to the original cream-and-blue icon. Elegant and useful at small header sizes, zero corporate gloss.
Constraints: exactly one folded N mark with one sage magnet and the exact word Noted; no other text, label, numeral, grid, background tile, framing, decorative objects, scenery or watermark. Real alpha transparency around the entire artwork and between the letters. No opaque shadow rectangle or fake transparency pattern.
```
