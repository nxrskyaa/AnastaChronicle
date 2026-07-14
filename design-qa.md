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

## Remaining low-priority polish

- Extremely narrow screens below 350px may benefit from shorter class labels.
- Auto Fishing balance can be tuned after live catch-rate telemetry exists.

final result: passed
