# Growing plant artwork

Generated with the built-in image-generation tool. The fridge and plant are separate transparent WebP layers; the kitchen stays independent.

## Assets and registration

- `../cream-fridge.webp`: bare frontal refrigerator, 1049 × 1500.
- `small.webp`: compact plant, 1049 × 1500.
- `growing.webp`: short trailing vine, 1049 × 1500.
- `lush.webp`: longer, fuller vines, 1049 × 1499.
- `overgrown.webp`: dense foliage with vines reaching toward the floor, 1049 × 1500.

WebP exports use quality 92 and alpha quality 100. All four plant images together are about 470 KiB. Preserve transparent canvas padding: the shared pot position anchors each stage to the same place on the refrigerator. Do not crop individual sprites to their visible leaves. The one-pixel height difference is normalized by the shared CSS layer.

Match the warm gouache illustration, olive foliage, ivory pot, and front-facing view. Keep the door faces clear. Plants must remain decorative and must not intercept dragging or cover post controls. Review every stage on desktop and narrow mobile layouts, including its transition. Reduced-motion preferences disable fades.

## Exact generation prompts

### Bare fridge edit

Edit this exact transparent refrigerator asset. REMOVE ONLY THE PLANT: all green leaves, vines, stems, pot and plant shadows above and to the right of the refrigerator must disappear into true alpha transparency. Reconstruct the small portion of the top rim previously covered by the plant as a clean continuous ivory rounded top. Preserve the refrigerator absolutely otherwise: identical door shapes, frontal view with NO side/back extrusion, ivory painted texture, gold and olive handles, seams, feet, base grille, front highlights, proportions and pixel placement. Keep exactly the same 1049 by 1500 canvas and transparent padding, no crop, no re-centering, no scaling, no widening. No notes, text, logos, artwork additions, or background. This will be the stable base layer under separate growing-plant sprites. Genuine transparent alpha output, no checkerboard painted into the image.

### Small plant

Create a standalone transparent PLANT SPRITE for overlaying the attached refrigerator reference. Reference is style/placement only. Do NOT render the fridge, cabinet, kitchen, surface, floor, shadow silhouette, labels or any lettering. Only a beautiful small warm ivory ceramic pot and variegated olive/sage pothos leaves, same soft painted gouache style as reference. Genuine transparent alpha, no checkerboard drawing.
CRITICAL REGISTRATION: portrait canvas exactly 1049x1500 with most of it EMPTY TRANSPARENT. Do not crop or center the plant. The pot is at TOP RIGHT, centered at pixel x=725, rim y=75, bottom y=110, about 120px wide. This fixed pot sits on a separate refrigerator's top. Keep these coordinates and pot size fixed across growth stages. Leaves may extend above pot but stay inside canvas. For trailing vines, route stems from pot toward x=910 at y=110 and DOWN the FAR RIGHT; below y=150 all leaves must stay within x=870..1015, keeping the entire broad central/left region transparent for interactive notes. Keep alpha clean around fine stems.
GROWTH STAGE 1 — SMALL: a young pothos with just 5-7 small leaves clustered above the pot, one tiny shoot toward the right, NO long trailing vine. Compact plant limited to roughly x=620..830 and y=15..110. Rest of 1049x1500 canvas must remain completely transparent. Gentle hand-painted details, soft cream highlights, muted organic greens.

### Growing plant

Use the provided small plant sprite as the exact registration and style reference. Generate a new growth stage of this same plant. Retain precisely the same full 1049x1500 transparent canvas and same pot at the same TOP RIGHT position, about center x=740 with pot base at y=205. Preserve the pot's shape, size, color and pixel position. Do not crop, recenter or auto-fit the subject. Real transparent alpha over all empty areas. ONLY the pothos and its ivory ceramic pot, absolutely NO fridge, shelf, surface, writing, guides, UI, labels or background.
Gouache painted variegated olive/sage leaves with warm soft highlights matching the reference. Grow outward from the existing plant. All trailing stems should arch right to x=930 by y=210 then descend on the FAR RIGHT. Below y=250, keep ALL foliage inside x=870..1015, and keep the whole central/left area transparent. This is an overlay for a separately rendered fridge.STAGE 2 — GROWING: a modestly fuller crown, about 12-16 leaves in total, one light trailing vine ending near y=550 (upper third of canvas). Clear spaces between individual leaves, not dense. Do not fill the bottom half. The pot is unchanged.

### Lush plant

Use the provided small plant sprite as the exact registration and style reference. Generate a new growth stage of this same plant. Retain precisely the same full 1049x1500 transparent canvas and same pot at the same TOP RIGHT position, about center x=740 with pot base at y=205. Preserve the pot's shape, size, color and pixel position. Do not crop, recenter or auto-fit the subject. Real transparent alpha over all empty areas. ONLY the pothos and its ivory ceramic pot, absolutely NO fridge, shelf, surface, writing, guides, UI, labels or background.
Gouache painted variegated olive/sage leaves with warm soft highlights matching the reference. Grow outward from the existing plant. All trailing stems should arch right to x=930 by y=210 then descend on the FAR RIGHT. Below y=250, keep ALL foliage inside x=870..1015, and keep the whole central/left area transparent. This is an overlay for a separately rendered fridge.STAGE 3 — LUSH: a fuller crown and TWO trailing vines with many variegated leaves, ending around y=950 (roughly two thirds down the canvas). Clear leaf silhouettes and some breathing room. Keep the exact same ivory pot and its position as reference. Trailing branches must remain on far right, x=870..1015; no foliage in the central region below y=250. The lower quarter remains transparent. Clearly more grown than the reference stage but not a tangled wall.

### Overgrown plant

Use the provided small plant sprite as the exact registration and style reference. Generate a new growth stage of this same plant. Retain precisely the same full 1049x1500 transparent canvas and same pot at the same TOP RIGHT position, about center x=740 with pot base at y=205. Preserve the pot's shape, size, color and pixel position. Do not crop, recenter or auto-fit the subject. Real transparent alpha over all empty areas. ONLY the pothos and its ivory ceramic pot, absolutely NO fridge, shelf, surface, writing, guides, UI, labels or background.
Gouache painted variegated olive/sage leaves with warm soft highlights matching the reference. Grow outward from the existing plant. All trailing stems should arch right to x=930 by y=210 then descend on the FAR RIGHT. Below y=250, keep ALL foliage inside x=870..1015, and keep the whole central/left area transparent. This is an overlay for a separately rendered fridge.STAGE 4 — OVERGROWN: a luxuriant dense crown across the top with three intertwined trailing vines and many large/small leaves, reaching y=1400 near the bottom of the canvas. This is the longest, fullest stage. Preserve exact same pot and its position. Let the crown spread LEFT across x=420..870 ABOVE y=200 only. Below y=250, keep trailing vines within x=860..1020 with lots of layered leaves but no leaves in the central/left area. Keep tips within canvas; do not clip leaf edges. More abundant than the lush reference, still beautiful and airy enough to read individual hand-painted variegated leaves. Fridge must not be rendered.
