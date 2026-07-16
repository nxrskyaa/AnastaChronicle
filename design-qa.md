# Anasta Chronicle mobile design QA

Viewport: 390 x 844

Evidence folder: `C:/Users/xywal/.codex/visualizations/2026/07/10/019f4b08-015c-7093-888a-b12e302e42e1/anasta-mobile-qa`

## Flow review

1. Loading gate — passed. The complete logo, Ritual lockup, progress state, and primary action form one centered composition without horizontal overflow.
2. Main menu — passed. The world masthead and parchment passport now share the viewport without the previous oversized showcase competing with the actions.
3. Character creator — passed. Mobile uses a horizontal preview strip and a full-width editor; the former 118px side rail and squeezed desktop columns are gone.
4. In-game HUD — passed. Minimap and guard shortcut are removed from the phone HUD, status is compact, and movement, attack/interact, and four class skills remain reachable without overlap.
5. Auto Fishing — passed by code-path review. Auto mode now starts the normal world fishing state and automatically performs cast, hook, tension control, catch reveal, and repeat. Moving or tapping the fishing action stops the loop.
6. Death and respawn — passed by code-path review. Death entry bounce and screen shake are disabled; respawn clears shake and hit-stop before restoring control.
7. About — passed. Only Nxrskyaa and Baster remain.
8. Notification safe areas — passed. Long toast copy wraps above the gameplay controls; the fishing HUD clears both touch clusters; catch cards use one mobile anchor and no longer stretch or clip.

Notification timing scales from 2.2 to 4.2 seconds based on message length. Fishing and catch states were measured independently at 390 x 844.

## Historical low-priority polish

- Extremely narrow screens below 350px may benefit from shorter class labels.
- Auto Fishing balance can be tuned after live catch-rate telemetry exists.

Historical result: passed

---

# Character Creator Mobile Design QA — 2026-07-16

- Source visual truth: `C:\Users\xywal\Documents\New project\.codex-remote-attachments\019f4b08-015c-7093-888a-b12e302e42e1\c562daa5-bae3-4e1b-8484-e96f08750813\1-Photo-1.jpg`
- Implementation screenshot: `C:\Users\xywal\Documents\New project\creator-mobile-qa-flat.png`
- Viewport: 430 x 844 CSS px; additional responsive check at 390 x 844 and 744 x 1133
- State: Guest Play > Create New Traveler > Appearance; red hair swatch selected
- Primary interactions tested: loading entry, Guest Play, Create New Traveler, Appearance tab, hair-color selection
- Console errors: none

## Full-view comparison evidence

The source capture showed a 96 x 108 character stage, parchment-colored blank swatches, and weak visual emphasis on the traveler. The repaired implementation uses a 144 x 156 stage at the main mobile breakpoint, displays the full palette, preserves the pixel-passport layout, and keeps the persistent action footer clear of the scrollable options.

## Focused region comparison evidence

The hair-color region was checked using computed styles. The first eight controls resolve to eight distinct RGB values, and all thirteen hair colors are unique. Selecting `#b5432f` changes `aria-pressed` to `true`, computes to `rgb(181, 67, 47)`, and immediately updates the character preview. At 390 px wide the stage remains 120 x 136 with no horizontal document overflow.

## Findings

- No remaining P0/P1/P2 issues in the tested mobile creator flow.
- Fonts and typography: existing pixel display and readable body-font hierarchy are preserved; labels remain legible at mobile sizes.
- Spacing and layout rhythm: the larger preview is balanced against the scrollable editor; tabs and footer remain persistent and usable.
- Colors and visual tokens: swatches now use the actual preset color through `--swatch-color`; selected state has a distinct green and parchment focus ring.
- Image quality and asset fidelity: the existing Anasta logo and code-rendered pixel character remain sharp with pixelated canvas rendering; no placeholder asset was introduced.
- Copy and content: customization names, class summary, tabs, and CTA copy are unchanged.

## Comparison history

1. Initial implementation check found the original P0 blank-palette bug: mobile `background-color: ... !important` overrode every inline swatch background. Fixed by passing each value through `--swatch-color` and consuming that variable in the mobile rule.
2. First visual pass found a P1 preview-size conflict: an older `#creator .preview-stage` selector kept the stage at 96 x 108. Fixed by matching its specificity in the final responsive rule. Post-fix evidence measures 144 x 156 at 430 px and 120 x 136 at 390 px.
3. Final pass verified distinct colors, selected state, scroll behavior, no horizontal overflow, working creator navigation, and zero console errors.

## Follow-up polish

- P3: a future pass could add a user-controlled preview zoom, but it is not required for legibility now.

final result: passed
