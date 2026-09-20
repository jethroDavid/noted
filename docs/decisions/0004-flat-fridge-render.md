# Flat fridge render

Date: 2026-09-20

## Context

Phase 2 built the fridge as a procedural Three.js scene with a CSS fallback behind the canvas. In practice the canvas never looked better than the flat version underneath: first paint showed the clean flat fridge, then the WebGL render covered it with a washed-out, muddier image. A tone-mapping fix closed the color gap, but the 3D geometry still read worse than the flat art, and a retro remodel attempt was rejected on sight.

## Decision

Render the fridge as one flat inline SVG illustration (`FlatFridge`) and stop mounting the canvas. The illustration carries the established almond two-door look: enamel body with a darker side face, doors with drop shadows, bowed-look handles, aluminum split edging, slatted grille, and feet. Post coordinates, layer order, decorations, and the 7:10 stage are unchanged.

The retired scene modules (`fridge-scene.tsx`, `models/`) and the Three.js / React Three Fiber dependencies were removed as a follow-up, along with the screenshot preview harness that loaded Three.js directly. The WebGL-loss browser test was removed because there is no WebGL path left to lose; the render test now asserts the flat illustration and the absence of any canvas.

## Consequences

- The fridge renders identically everywhere HTML renders, with no GPU, context, or animation-frame behavior to fail.
- No runtime 3D cost: no canvas, no demand loop, no device-pixel-ratio handling.
- Follow-up completed: the retired scene modules, dependencies, and screenshot preview harness were deleted.

## Illustrated artwork follow-up

The user subsequently supplied a soft painted kitchen reference and approved an image-based approach. The live renderer now uses a transparent fridge WebP and a matching separate kitchen background. The SVG remains the local fallback for a missing or failed image. The decision to keep interactions in HTML and avoid a live canvas still applies; see [the current illustration guide](../design/fridge-illustration.md).
