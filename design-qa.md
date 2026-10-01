1|# Anasta Chronicle mobile design QA
2|
3|Viewport: 390 x 844
4|
5|Evidence folder: `C:/Users/user/.codex/visualizations/2026/07/10/019f4b08-015c-7093-888a-b12e302e42e1/anasta-mobile-qa`
6|
7|## Flow review
8|
9|1. Loading gate — passed. The complete logo, Ritual lockup, progress state, and primary action form one centered composition without horizontal overflow.
10|2. Main menu — passed. The world masthead and parchment passport now share the viewport without the previous oversized showcase competing with the actions.
11|3. Character creator — passed. Mobile uses a horizontal preview strip and a full-width editor; the former 118px side rail and squeezed desktop columns are gone.
12|4. In-game HUD — passed. Minimap and guard shortcut are removed from the phone HUD, status is compact, and movement, attack/interact, and four class skills remain reachable without overlap.
13|5. Auto Fishing — passed by code-path review. Auto mode now starts the normal world fishing state and automatically performs cast, hook, tension control, catch reveal, and repeat. Moving or tapping the fishing action stops the loop.
14|6. Death and respawn — passed by code-path review. Death entry bounce and screen shake are disabled; respawn clears shake and hit-stop before restoring control.
15|7. About — passed. Only Nxrskyaa and Baster remain.
16|8. Notification safe areas — passed. Long toast copy wraps above the gameplay controls; the fishing HUD clears both touch clusters; catch cards use one mobile anchor and no longer stretch or clip.
17|
18|Notification timing scales from 2.2 to 4.2 seconds based on message length. Fishing and catch states were measured independently at 390 x 844.
19|
20|## Historical low-priority polish
21|
22|- Extremely narrow screens below 350px may benefit from shorter class labels.
23|- Auto Fishing balance can be tuned after live catch-rate telemetry exists.
24|
25|Historical result: passed
26|
27|---
28|
29|# Character Creator Mobile Design QA — 2026-07-16
30|
31|- Source visual truth: `C:\Users\user\Documents\New project\.codex-remote-attachments\019f4b08-015c-7093-888a-b12e302e42e1\c562daa5-bae3-4e1b-8484-e96f08750813\1-Photo-1.jpg`
32|- Implementation screenshot: `C:\Users\user\Documents\New project\creator-mobile-qa-flat.png`
33|- Viewport: 430 x 844 CSS px; additional responsive check at 390 x 844 and 744 x 1133
34|- State: Guest Play > Create New Traveler > Appearance; red hair swatch selected
35|- Primary interactions tested: loading entry, Guest Play, Create New Traveler, Appearance tab, hair-color selection
36|- Console errors: none
37|
38|## Full-view comparison evidence
39|
40|The source capture showed a 96 x 108 character stage, parchment-colored blank swatches, and weak visual emphasis on the traveler. The repaired implementation uses a 144 x 156 stage at the main mobile breakpoint, displays the full palette, preserves the pixel-passport layout, and keeps the persistent action footer clear of the scrollable options.
41|
42|## Focused region comparison evidence
43|
44|The hair-color region was checked using computed styles. The first eight controls resolve to eight distinct RGB values, and all thirteen hair colors are unique. Selecting `#b5432f` changes `aria-pressed` to `true`, computes to `rgb(181, 67, 47)`, and immediately updates the character preview. At 390 px wide the stage remains 120 x 136 with no horizontal document overflow.
45|
46|## Findings
47|
48|- No remaining P0/P1/P2 issues in the tested mobile creator flow.
49|- Fonts and typography: existing pixel display and readable body-font hierarchy are preserved; labels remain legible at mobile sizes.
50|- Spacing and layout rhythm: the larger preview is balanced against the scrollable editor; tabs and footer remain persistent and usable.
51|- Colors and visual tokens: swatches now use the actual preset color through `--swatch-color`; selected state has a distinct green and parchment focus ring.
52|- Image quality and asset fidelity: the existing Anasta logo and code-rendered pixel character remain sharp with pixelated canvas rendering; no placeholder asset was introduced.
53|- Copy and content: customization names, class summary, tabs, and CTA copy are unchanged.
54|
55|## Comparison history
56|
57|1. Initial implementation check found the original P0 blank-palette bug: mobile `background-color: ... !important` overrode every inline swatch background. Fixed by passing each value through `--swatch-color` and consuming that variable in the mobile rule.
58|2. First visual pass found a P1 preview-size conflict: an older `#creator .preview-stage` selector kept the stage at 96 x 108. Fixed by matching its specificity in the final responsive rule. Post-fix evidence measures 144 x 156 at 430 px and 120 x 136 at 390 px.
59|3. Final pass verified distinct colors, selected state, scroll behavior, no horizontal overflow, working creator navigation, and zero console errors.
60|
61|## Follow-up polish
62|
63|- P3: a future pass could add a user-controlled preview zoom, but it is not required for legibility now.
64|
65|## Character Creator iPad Landscape QA — 2026-07-16
66|
67|- Source visual truth: `C:\Users\user\AppData\Local\Temp\codex-clipboard-dc22a08c-6c61-4a8a-97bb-4c704ccd4cdc.png`
68|- Implementation screenshot: `C:\Users\user\Documents\New project\creator-ipad-landscape-qa.png`
69|- Viewport: 1024 x 896 CSS px (iPad landscape layout)
70|- State: Guest Play > Create New Traveler > Appearance; red hair swatch selected
71|- Primary interactions tested: Guest Play, Create New Traveler, Appearance tab, hair-color selection
72|
73|### Regression and root cause
74|
75|The earlier palette fix only consumed `--swatch-color` inside the phone breakpoint. At iPad landscape width, the desktop parchment rule still won the cascade, so all 13 hair controls computed to the same `rgb(216, 181, 120)`. The preview canvas also rendered wider than its 288 px stage, producing the cropped and stretched character shown in the supplied capture.
76|
77|### Post-fix evidence
78|
79|- All 13 hair controls now compute to 13 distinct RGB colors at 1024 x 896.
80|- Selecting `#b5432f` sets `aria-pressed="true"` and computes to `rgb(181, 67, 47)`.
81|- Preview stage: 288 x 456.4 px. Preview canvas: 282.74 x 451.6 px, fully contained inside the stage.
82|- Document horizontal overflow: 0 px.
83|- The canvas backing size and pixel scale now follow the responsive preview slot, keeping the traveler centered and sharp instead of stretching the old fixed buffer.
84|
85|### Findings
86|
87|- No remaining P0/P1/P2 issue in the tested iPad landscape creator flow.
88|- The fix applies across creator layouts instead of relying on a portrait-only media query.
89|- Existing pixel-art controls, class data, customization content, and creator behavior remain unchanged.
90|
91|final result: passed
92|