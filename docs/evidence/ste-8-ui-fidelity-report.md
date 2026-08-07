# STE-8 M1 UI-fidelity evidence report

Date: 2026-08-05

Branch: `codex/m1-rivet-foundation-evaluation-walking-skeleton`

Draft PR: [#2](https://github.com/StefanosCodes/Clio/pull/2)
Status: final M1 UX closeout verified locally; final owner visual acceptance pending

## Authority and acceptance

- Historical visual sources: `StefanosCodes/Rivet@cf116a9968d59f2c72b900cbc42a5f3ab5a9acf4` plus the owner-supplied Codex workspace and ChatGPT screenshots. Those immutable files remain in the repository as source evidence.
- Active regression authority: the owner-approved Clio M1 product contract in [`ste-8-m1-ux-closeout.md`](./ste-8-m1-ux-closeout.md). It supersedes exact Rivet comparison for navigation sizing, empty-state copy, composer controls, Settings placement, and Packet presentation.
- Authoritative paths, hashes, tokens, adaptation rules, and stop conditions are frozen in [`ste-8-ui-fidelity-contract.md`](./ste-8-ui-fidelity-contract.md).
- The repository owner accepted the representative shell in this Codex task with: “Yes very much so continue.” This cleared the early representative-screen gate; it is not yet the final acceptance required before STE-8 returns to Done.
- The original immutable Rivet captures remain historical references and are not overwritten by the active Clio M1 baselines.

## Deterministic comparison contract

- Runner: [`scripts/verify-ui-fidelity.mjs`](../../scripts/verify-ui-fidelity.mjs).
- Command: `npm run verify:ui` (also included in `npm run verify`).
- Browser: repository-pinned Playwright/Chromium, DPR 1, UTC, `en-US`, loaded fonts, reduced motion, and settled 180ms Rivet transitions.
- Threshold: SSIM ≥ 0.999 and perceptual mismatch ratio ≤ 0.001.
- Masks: none. Layout, typography, color, geometry, icons, and navigation are never masked.
- Machine-readable result: [`ui-fidelity/regression-current/report.json`](./ui-fidelity/regression-current/report.json).

## Surface and state results

Every row has a same-condition normalized reference, implementation capture, and diff in `docs/evidence/ui-fidelity/regression-current/`.

| Surface/state | Viewport/theme | Classification | SSIM | Perceptual mismatch | Result |
| --- | --- | --- | ---: | ---: | --- |
| Empty shell | 1440×900 dark | owner-approved M1 contract | 1.000000000 | 0% | production-parity |
| Empty shell | 1440×900 light | owner-approved M1 contract | 1.000000000 | 0% | production-parity |
| Empty shell | 390×844 dark | owner-approved responsive contract | 1.000000000 | 0% | production-parity |
| Empty shell | 390×844 light | owner-approved responsive contract | 1.000000000 | 0% | production-parity |
| Populated chat | 1280×800 dark | owner-approved M1 contract | 1.000000000 | 0% | production-parity |
| Populated chat | 390×844 dark | owner-approved responsive contract | 1.000000000 | 0% | production-parity |
| Populated chat | 390×844 light | owner-approved responsive contract | 1.000000000 | 0% | production-parity |
| Streaming/thinking | 1440×900 dark | adapted lifecycle semantics | 1.000000000 | 0% | production-parity |
| Disconnected/reconnect | 1440×900 dark | adapted lifecycle semantics | 1.000000000 | 0% | production-parity |
| Canceled/retry | 1440×900 dark | adapted lifecycle semantics | 1.000000000 | 0% | production-parity |
| Failed/retry | 1440×900 dark | adapted lifecycle semantics | 1.000000000 | 0% | production-parity |
| Loading | 1440×900 dark | adapted lifecycle semantics | 1.000000000 | 0% | production-parity |
| Split chat + Build Packet workspace | 1440×900 dark | owner-approved Packet document contract | 0.999999737 | 0% | production-parity |
| Split chat + Build Packet workspace | 1440×900 light | owner-approved Packet document contract | 1.000000000 | 0% | production-parity |
| Build Packet workspace | 1440×900 dark | owner-approved Packet document contract | 1.000000000 | 0% | production-parity |
| Activity rail | 1440×900 dark | owner-approved Clio product contract | 0.999999846 | 0% | production-parity |
| Build Packet mobile sheet | 390×844 light | owner-approved responsive contract | 1.000000000 | 0% | production-parity |
| Activity rail | 390×844 dark | owner-approved responsive contract | 1.000000000 | 0% | production-parity |
| In-thread Packet starter | 1440×900 dark | owner-approved first-value path | 1.000000000 | 0% | production-parity |
| Expanded navigation | 1440×900 dark | owner-approved M1 contract | 1.000000000 | 0% | production-parity |
| Open mobile navigation | 390×844 dark | owner-approved responsive contract | 1.000000000 | 0% | production-parity |
| Settings — Knowledge Base | 1440×900 dark | deferred Settings surface | 1.000000000 | 0% | production-parity |
| Settings — Plugins | 1440×900 dark | deferred Settings surface | 0.999999982 | 0% | production-parity |

## Browser interaction QA

The earlier STE-8 receipt records the real API/PostgreSQL create, stream, persist,
version, tenant-switch, and reopen workflow. The final closeout changed frontend
presentation only. Current closeout browser evidence covered:

1. Deterministic Chromium traversal of 23 desktop/mobile, light/dark, lifecycle,
   Packet, navigation, and Settings states.
2. Explicit in-thread first-Packet action in populated chat, absent while streaming.
3. Saved Packet document rendering in split, full, and mobile surfaces.
4. Expanded Settings navigation with Knowledge Base and Plugins selected through
   durable development deep links.
5. Manual image inspection of empty chat, Packet starter, Settings, and mobile
   Packet captures for clipping, overlap, and incomplete rendering.

The in-app browser tab was successfully claimed, but its post-change reload was blocked
by the browser's local-URL policy. No fresh real-tab interaction is claimed for this
closeout; the repository-pinned Playwright runner is the current browser evidence.

## Functional and accessibility evidence

- Frontend component/state tests: 8 files, 43 tests passed.
- TypeScript project check: passed.
- Vite production build: passed.
- Default backend suite: 11 passed, 1 explicitly skipped PostgreSQL marker.
- PostgreSQL integration: 1 passed against `clio-m1-postgres` on loopback after making the tenant assertion independent of pre-existing fixture rows.
- Dependency audit: 0 vulnerabilities.
- Semantic QA: named navigation, theme, packet, retry, stop, mobile close/dismiss, message, and organization controls are present in browser accessibility snapshots.
- Keyboard/focus contract: source focus-visible outlines are retained; native select semantics are retained; dialogs/drawers have labels and Escape/close behavior where provided by Rivet.
- Reduced motion: the source-wide `prefers-reduced-motion` override is retained and deterministic captures run with reduced motion.

## Adaptations, deferrals, and exclusions

- Adapted: Rivet → Clio terminology; compact/resizable navigation; fixture organization selector; generated Clio DTO/query/stream state; freeform composer without tool/skill controls; in-thread Packet starter; saved read-only Markdown Packet; safe activity rail; and Clio reconnect/cancel/retry semantics.
- Deferred without invented behavior: knowledge ingestion, plugin execution, saved Packet editing/version management, and conversation rename/pin/archive/delete APIs. Unavailable execution actions are not exposed.
- Excluded: Rivet persistence, Supabase service-role REST access, CLI/brain, generic registries, historical evaluation claims, and unrelated provider behavior.
- Intentionally different visuals: the owner-authorized M1 shell uses compact navigation, simplified freeform composer, Settings-owned deferred capabilities, and a Markdown Packet reader. Historical Rivet captures remain source evidence rather than the active regression target.
- The obsolete beige/sage shell and the old standalone Packet drawer are removed from the default workflow.

## Remaining completion gate

The verified corrective slice is recorded on the existing M1 branch and Draft PR #2.
STE-8 remains open until the repository owner reviews the final running UI/comparisons
and gives explicit visual acceptance. No merge or deployment is authorized.
