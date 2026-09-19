# Fridge models

The playground offers three procedural Three.js models: Sage classic (stacked doors), Butter retro (one rounded door), and Blue duo (two upper doors and a broad lower door). The palette button at the upper right opens a chooser with a small preview of each design.

Selection is temporary React state in `FridgeApp`, just like the playground's posts. Changing the model preserves posts, edits, removal timers, and positions. Refreshing restores the default Sage classic. There is no database preference yet.

## Where things live

- [models/index.ts](../../packages/fridge-ui/src/models/index.ts): registry of model IDs, names, descriptions, and React components; also defines the default model.
- [models/](../../packages/fridge-ui/src/models/): one geometry component per design, plus a shared rounded-part helper.
- [fridge-scene.tsx](../../packages/fridge-ui/src/fridge-scene.tsx): shared camera, lighting, rendering, and WebGL failure handling. It selects a component from the registry.
- [model-picker.tsx](../../packages/fridge-ui/src/model-picker.tsx): chooser generated from the registry, with keyboard focus, Escape, and outside dismissal.
- [styles.css](../../packages/fridge-ui/src/styles.css): chooser previews, model-specific decoration placement, and the CSS fridge used when 3D is unavailable. Model variations use `data-model` selectors.

All of this lives in the shared React package, so future platform shells can use the same models and chooser.

## Shared coordinates

The models use the same fixed 7:10 scene frame. The orthographic camera looks straight down the Z axis; depth comes from the geometry and lighting. Keep each model centered around the origin, roughly 6 units wide and 9.3 units tall, inside the 7-by-10 frame.

Posts are accessible HTML over the canvas. Their shared surface starts at 10.5% from the left and 6.5% from the top of the stage, with width 77.1428571% and height 87%. This covers almost the entire front, including the upper door. Handles, door seams, and decorations may sit beneath posts and must not intercept their interactions. The scene and board stay mounted while only the geometry component changes; model selection must not reset the post state or change its coordinates.

The surface uses 540 × 870 logical units for card sizing and bounds. Those units are independent of Three.js world units. Keep them synchronized with the CSS surface so cards retain their original display dimensions as the draggable area expands. The fridge keeps its original display size.

## Add another model

1. Add a React geometry component under `models/`, using the existing components and `RoundedPart` as references. Keep camera and lighting in the scene.
2. Register a stable ID, display name, description, and component in `models/index.ts`. The chooser and `FridgeModelId` automatically include it.
3. Add its `data-model` styles for color variables, the chooser preview, and the CSS fallback. Adjust decorative lettering or stickers if the new door layout needs it.
4. Review it on desktop and a narrow touch viewport. Check the silhouette, palette button, decorations, and notes at the edges of the usable surface. Also inspect the fallback without WebGL.
5. Extend the model-switching browser check to include the new ID. Verify that edited and moved notes survive each switch, keyboard dismissal returns focus, and the chooser stays within the screen.

To deliberately change the usable note surface, update the CSS surface and logical board dimensions together, and verify alignment with every model; swapping a cosmetic model alone should not move posts. A future design with a different board shape will need an explicit surface mapping.

Run `pnpm check` and `pnpm test:browser` for implementation changes. Interface icons follow [the icon guidelines](./icons.md).
