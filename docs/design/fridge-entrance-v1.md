# Fridge entrance and quiet scene sound

The cream appliance keeps its original closed appearance. An SVG aperture removes only the face from the original image, leaving a fixed outer casing. The same aperture clips the generated interior and hinged face, so the interior remains stationary and the opaque face naturally covers it when closing. There is no fade or artwork swap at closure. The face carries the notes and magnets; both doors close together over 1.15 seconds, once per scene entry. Board refreshes do not restart it. Reduced motion, image failure, hiding the tab, resizing, or leaving the scene settle the appliance without replay.

The door accelerates into contact; its closing tween's completion triggers a short synthesized seal thump, followed 25 ms later by a quiet recorded glass rattle. There is no separate timestamp or asynchronous loading in the impact callback. The recording is decoded ahead of the entrance; if it is unavailable at contact, only the thump plays. The glass is low-pass filtered at 4.2 kHz and played at gain 0.018 behind the shared output gain 0.4. One home-scoped Web Audio context is unlocked by a real pointer or keyboard gesture; mute carries between fridge and TV and stops any remaining closure sound. The empty TV receiver uses gain 0.003, fades smoothly, stays silent on paused ready clips, and disconnects on scene exit. An empty TV shows “Tap for sound” until a gesture creates its audio context. Sounds suspend in hidden tabs.

## Audio provenance

- `apps/web/public/sound/glass-bottle-rattle.wav` derives from `sfx/vials-glass-rattle-04.wav` in Vehicle (Jan Schupke)'s [Fantasy Accessory SFX Library](https://lpc.opengameart.org/content/fantasy-accessory-sfx-library).
- License: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The source archive is `https://lpc.opengameart.org/sites/default/files/accessory.zip`.
- Converted to mono, trimmed 23.7 ms of leading silence, and added a 5 ms end fade. Runtime export: 44.1 kHz, 16-bit PCM WAV, 0.372 seconds, 32,876 bytes. The low playback level and filtering are applied by Web Audio, not baked into the asset.

## Artwork provenance

- Reference: `apps/web/public/scene/sunday/fridge-cream.webp`.
- Generated source: `C:/Users/jethr/.codex/generated_images/01a0ff18-5224-7c31-b30e-d7b3a46a27a1/exec-fda1db44-4451-4d66-bcc3-cdcd176996d5.png`.
- Runtime export: `apps/web/public/scene/sunday/fridge-interior-v1.webp`, 900×1501, alpha preserved.
- Generated using the built-in image-generation tool; resized and encoded to WebP for the app.

## Exact prompt

```text
Use case: stylized-concept. Asset type: illustrated refrigerator interior backing layer for a hinged-door entrance animation in Noted. Reference image role: match the warm cream enamel, painterly edges and simple nostalgic appliance proportions; do not include the reference's closed doors. Primary request: one straight-on, front-facing open refrigerator cabinet WITHOUT ANY DOORS, handles or door fronts. Show the inside recess behind where the doors would be: shallow upper freezer compartment occupying the top quarter; taller lower fridge interior with two restrained shelves, three small clear glass bottles together on one shelf and one plain lidded food container. Keep contents sparse and quiet. Rounded warm ivory enamel surround, simple grey rubber seal, pale muted sage shadows in interior, soft warm light inside. Same gently worn handpainted illustration style as reference, no photorealism. Composition: isolated narrow upright appliance approximately 3:5 overall ratio, centered and filling canvas with modest transparent margins. Entire cabinet visible including two tiny feet, flat front view, no perspective tilt, no swung-open doors. Transparent alpha outside appliance, no background room, no lettering or logos, no UI, no dramatic glow or busy food assortment. This will be visible briefly behind the existing illustrated door and should match its rounded casing and low-detail cozy feel.
```
