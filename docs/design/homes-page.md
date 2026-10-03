# Homes chooser

The `/app` page continues the login's ivory paper, sage ink, and shared Kalam handwriting. It retains the existing authenticated homes query, links, creation mutation, and sign-out flow.

- A compact Noted header identifies the app and current account.
- Home links use hand-drawn house markers, readable names, Creator/Member roles, and an entry arrow.
- A taped note contains the labeled create-home form. It sits beside the homes on wide screens and below them on phones.
- Loading, signed-out, empty, query-error, and creation-error states use the same visual language. Query errors include a retry control.
- Inputs and buttons have visible focus states and comfortable touch targets. Blank or pending submissions are disabled, and the original 80-character limit remains.
- The login's final pull dissolves into the shared ivory paper, then the homes page fades its content in. The heading and creation note enter once when the signed-in workspace mounts; query loading and home-count changes do not restart them.
- Each keyed home card owns its entrance. Initial homes arrive with a short stagger; subsequent additions animate only the new card, preserving existing cards and the creation form.
- Home links share the Google button's elastic lift, paper-outline flex, keyboard-focus response, and press compression through the web shell's `usePaperMotion` hook. Reduced-motion settings skip all movement and keep content visible immediately.

Paper texture and button artwork are shared with the login through `packages/ui/src/paper-art.tsx`. No new background image, API, auth adapter, or preview route is introduced.
