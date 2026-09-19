# Noted icon design guidelines

Status: current style, documented from the existing implementation on 2026-09-18.

Use this document when adding icons or deliberately changing their visual language. An ordinary addition follows the current rules and references. A requested redesign updates this document and the affected artwork together so subsequent additions follow the new style.

## Interface icons

The interface uses simple, calm outline icons with rounded strokes. Shapes should be recognizable at small sizes and feel at home beside the fridge's soft colors and casual lettering. The icons themselves use clean geometry; the handwritten character comes from the surrounding typography and decoration.

The implementation reference is [icons.tsx](../../packages/fridge-ui/src/icons.tsx). Its shared `Icon` component owns the SVG attributes; individual icons supply their geometry.

| Property             | Current rule                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| Canvas               | `viewBox="0 0 24 24"`                                                                                   |
| Default display size | 20 × 20 CSS pixels; use the existing `size` prop for other sizes                                        |
| Stroke               | 1.6 SVG units, scaling with the icon                                                                    |
| Ends and joins       | `strokeLinecap="round"`, `strokeLinejoin="round"`                                                       |
| Fill                 | `fill="none"`                                                                                           |
| Color                | `stroke="currentColor"`; the surrounding control supplies the color                                     |
| Geometry             | A few paths, lines, circles, or rounded rectangles; use only the detail needed to recognize the meaning |
| Placement            | Center optically within the canvas; most silhouettes fit between coordinates 3 and 21                   |
| Edge allowance       | Keep the visible stroke inside the canvas; existing microphone geometry reaches coordinate 22           |
| Decoration           | No embedded background, shadow, gradient, texture, lettering, or animation in ordinary interface icons  |

The coordinate range is a starting guide, not a demand to stretch every shape to the same bounds. A plus sign should have breathing room; an enclosing circle needs more canvas. Compare apparent size and stroke density with the existing icons rather than matching bounding boxes mechanically.

Reference examples in `icons.tsx`:

- `plus` and `close`: minimal crossed lines and rounded ends.
- `photo`: an 18 × 18 frame starting at (3, 3), corner radius 3, a small sun, and a simple landscape.
- `voice`: a rounded microphone capsule and a few supporting lines.
- `home`: a recognizable roof and doorway with little detail.
- `help`: a circular enclosure with an uncluttered question mark.
- `palette`: a curved artist's palette with three small paint circles, used to choose the fridge model.

Read their actual SVG geometry before drawing a new member of the set. These are examples of the style, not templates that require every icon to contain the same shapes.

## Implementation and accessibility

- Add the icon name and geometry to the existing `Icon` component. Use its shared attributes instead of repeating an SVG wrapper for each icon.
- Keep this code usable by React DOM in Next.js, Capacitor, and Electron. Do not import a platform-specific image or icon component.
- The SVG is currently decorative (`aria-hidden="true"`). The containing button or link must provide visible text or an accessible label describing the action.
- Keep focus indicators, disabled states, hit areas, and interaction behavior on the containing control. Increasing the icon size is not a substitute for a usable hit area.
- Colors come from the containing control and shared styles. Colored toolbar tiles are separate from the icon geometry.
- Preserve icon names, meanings, and accessible control labels during a visual-only redesign unless the requested change also alters the action.

The `Waveform` component in the same file is a decorative audio illustration built from vertical bars. Hearts, stars, magnets, tape, and other fridge ornaments belong to the illustration language. They do not need to adopt the 24-unit outline rules when adding a normal interface icon.

## Brand mark and wordmark

The Noted mark is its own family: three filled, softly rounded sage bars with a slight tilt. Preserve its silhouette when producing another size or platform asset.

References:

- [fridge-app.tsx](../../packages/fridge-ui/src/fridge-app.tsx): header markup and accessible home link.
- [styles.css](../../packages/fridge-ui/src/styles.css): `.brand-mark`, `.wordmark`, and `.brand-dot`.
- [favicon.svg](../../apps/web/public/favicon.svg): the small square brand asset.

Current header mark: three 7-pixel-wide bars separated by 3 pixels, outer bars 22 pixels tall, and a 15-pixel middle bar. Corners have a 2-pixel radius. The whole group rotates −10 degrees and the middle bar rotates an additional −25 degrees. The fill is sage `#6a7e57`.

The wordmark is lowercase `noted.` in DM Sans at weight 600, with −1.7-pixel letter spacing. It displays at 32 pixels on desktop and 28 pixels at the small-screen breakpoint. The dot uses the same sage color as the mark.

The favicon is a deliberately adjusted small-size rendition, not a literal copy of the header dimensions. It uses a 48 × 48 viewBox, a warm cream `#f4f1e9` background with radius 12, and three sage bars. Consult its SVG for exact geometry. Check the silhouette at 16 and 32 pixels before accepting an update.

Change the brand only when the user requests brand work. For a brand redesign, review the header mark, wordmark, and favicon together and state which assets the new direction covers.

## Workflow and visual review

1. Determine whether the request adds an icon, changes the interface family, or changes the brand. Follow the existing family unless the user asks for a style change.
2. Read this guide and the relevant source references. For an addition, choose two existing icons to compare against.
3. Implement the geometry using the shared component. For a redesign, record the new stroke, shapes, spacing, color behavior, and reference examples here, then apply them across the requested set.
4. View the result alongside existing icons in the actual interface. Check the default 20-pixel size and any smaller or larger size used by that control, including 14 pixels for the current small plus icons.
5. Check recognition, optical alignment, stroke weight, spacing, clipping, and readability on the actual background. Confirm that text or accessible labels still name the action.
6. Run the relevant formatting, lint, and type checks after code changes. Use existing browser checks when control behavior changes. Keep visual review part of the work: written rules alone do not prove that an icon looks consistent.

## Reusable requests

### Add an icon in the current style

> Add a [calendar] interface icon for [choosing a date]. Follow `docs/design/icons.md` and compare it with the existing icons in `packages/fridge-ui/src/icons.tsx`. Reuse the shared SVG attributes and preserve the current icon family. Review it at the actual display sizes beside the existing icons and ensure its control has an accessible name.

### Redesign the interface icon family

> Change the interface icon language to [describe the desired style]. Start with `docs/design/icons.md` and inspect the existing set. Translate the requested style into concrete geometry, stroke, spacing, and color rules, update the guide, and redraw all interface icons covered by the request consistently. Preserve their meanings, public names, and accessible control labels. Visually review the set at the sizes used by the app. The scope is interface icons; retain the current brand artwork.

### Redesign the brand artwork

> Update the Noted brand mark and wordmark toward [describe the desired style], using `docs/design/icons.md` as the starting reference. Update the header artwork and favicon together, document the new brand rules, and review the result at header and favicon sizes. Preserve the interface icon family unless I also request an interface-icon redesign.
