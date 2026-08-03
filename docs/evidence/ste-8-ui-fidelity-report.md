# STE-8 corrective UI-fidelity evidence report

Date: 2026-08-03

Branch: `codex/m1-rivet-foundation-evaluation-walking-skeleton`

Draft PR: [#2](https://github.com/StefanosCodes/Clio/pull/2)
Status: full repair verified locally; final owner visual acceptance pending

## Authority and acceptance

- Accepted visual source: `StefanosCodes/Rivet@cf116a9968d59f2c72b900cbc42a5f3ab5a9acf4`.
- Authoritative paths, hashes, tokens, adaptation rules, and stop conditions are frozen in [`ste-8-ui-fidelity-contract.md`](./ste-8-ui-fidelity-contract.md).
- The repository owner accepted the representative shell in this Codex task with: “Yes very much so continue.” This cleared the early representative-screen gate; it is not yet the final acceptance required before STE-8 returns to Done.
- The original immutable Rivet captures are retained separately from the normalized Clio-string/organization reference fixtures.

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
| Empty shell | 1440×900 dark | exact presentation, adapted strings/account | 0.999961608 | 0.0003086% | production-parity |
| Empty shell | 1440×900 light | exact presentation, adapted strings/account | 0.999960567 | 0.0002315% | production-parity |
| Empty shell | 390×844 dark | exact responsive presentation | 0.999206794 | 0.0148864% | production-parity |
| Empty shell | 390×844 light | exact responsive presentation | 0.999302134 | 0.0148864% | production-parity |
| Populated chat | 1280×800 dark | exact presentation, fixture data | 0.999977064 | 0.0003906% | production-parity |
| Populated chat | 390×844 dark | exact responsive presentation | 0.999999004 | 0% | production-parity |
| Populated chat | 390×844 light | exact responsive presentation | 0.999999204 | 0% | production-parity |
| Streaming/thinking | 1440×900 dark | adapted Clio events in Rivet activity UI | 0.999961233 | 0.0003086% | production-parity |
| Disconnected/reconnect | 1440×900 dark | adapted lifecycle semantics | 0.999961278 | 0.0003086% | production-parity |
| Canceled/retry | 1440×900 dark | adapted lifecycle semantics | 0.999961175 | 0.0003086% | production-parity |
| Failed/retry | 1440×900 dark | adapted lifecycle semantics | 0.999961278 | 0.0003086% | production-parity |
| Loading | 1440×900 dark | adapted lifecycle semantics | 0.999961175 | 0.0003086% | production-parity |
| Inline Build Packet | 1440×900 dark | owner-approved Clio product contract | 1.000000000 | 0% | production-parity |
| Build Packet document rail | 1440×900 light | owner-approved Clio product contract | 1.000000000 | 0% | production-parity |
| Build Packet workspace | 1440×900 dark | owner-approved Clio product contract | 1.000000000 | 0% | production-parity |
| Activity rail | 1440×900 dark | owner-approved Clio product contract | 1.000000000 | 0% | production-parity |
| Build Packet document rail | 390×844 light | owner-approved responsive contract | 1.000000000 | 0% | production-parity |
| Activity rail | 390×844 dark | owner-approved responsive contract | 1.000000000 | 0% | production-parity |
| Collapsed navigation | 1440×900 dark | exact presentation | 0.999923820 | 0.0003086% | production-parity |
| Open mobile navigation | 390×844 dark | exact presentation | 0.999931585 | 0.0012152% | production-parity |
| Knowledge placeholder | 1440×900 dark | deferred capability in Rivet library treatment | 0.999971829 | 0.0002315% | production-parity |
| Plugins placeholder | 1440×900 dark | deferred capability in Rivet library treatment | 0.999961767 | 0.0003086% | production-parity |

## Browser interaction QA

The in-app browser exercised the real API and local PostgreSQL runtime, not the screenshot fixtures:

1. Created a new Acme conversation through `New Chat`; the URL changed to its durable conversation ID.
2. Sent `Verify the accepted Rivet fidelity repair end to end.` and observed the saved user message plus fixture assistant response in the Rivet transcript/compact-composer layout.
3. Reloaded the page and observed both messages reopen from PostgreSQL.
4. Opened an inline Build Packet card in the right document rail, changed `Outcome`, and saved a durable version 3.
5. Expanded that rail into the central Packet workspace, then reloaded the conversation and observed version 3 and the edited outcome restored from PostgreSQL.
6. Inspected the activity rail and verified its safe stage/source/tool summary, deterministic title, close control, and Escape behavior.
7. Switched Acme → Orbit and observed only Orbit conversations; the Acme QA message was absent. Switched back and reopened the Acme conversation URL.
8. Collapsed and expanded the desktop navigation.
9. Switched dark → light → dark and verified the document theme contract.
10. Opened and dismissed the mobile navigation at 390×844.
11. Inspected deterministic streaming, disconnected, canceled, failed, loading, inline Packet, Packet rail/workspace, activity rail, empty, and populated states using the same application components.

A final fresh-page browser pass loaded the current real API/PostgreSQL state with zero console errors and zero console warnings. An earlier development tab had recorded a Vite hot-reload warning after an effect dependency changed during implementation; that stale development-only log did not recur on the fresh page.

## Functional and accessibility evidence

- Frontend component/state tests: 7 files, 33 tests passed.
- TypeScript project check: passed.
- Vite production build: passed.
- Default backend suite: 11 passed, 1 explicitly skipped PostgreSQL marker.
- PostgreSQL integration: 1 passed against `clio-m1-postgres` on loopback after making the tenant assertion independent of pre-existing fixture rows.
- Dependency audit: 0 vulnerabilities.
- Semantic QA: named navigation, theme, packet, retry, stop, mobile close/dismiss, message, and organization controls are present in browser accessibility snapshots.
- Keyboard/focus contract: source focus-visible outlines are retained; native select semantics are retained; dialogs/drawers have labels and Escape/close behavior where provided by Rivet.
- Reduced motion: the source-wide `prefers-reduced-motion` override is retained and deterministic captures run with reduced motion.

## Adaptations, deferrals, and exclusions

- Adapted: Rivet → Clio terminology; Rivet account area → fixture organization selector; Rivet state internals → generated Clio DTO/query/stream state; completed artifact → inline Build Packet plus contextual document rail/full workspace; run detail → safe contextual activity rail; lifecycle messages → Clio reconnect/cancel/retry semantics.
- Deferred without invented behavior: knowledge ingestion, plugin execution, and conversation rename/pin/archive/delete APIs. Their presentation remains in Rivet language, but unavailable actions are not falsely exposed.
- Excluded: Rivet persistence, Supabase service-role REST access, CLI/brain, generic registries, historical evaluation claims, and unrelated provider behavior.
- Intentionally different visuals: none.
- The obsolete beige/sage shell and permanent packet column are removed.

## Remaining completion gate

Before STE-8 returns to Done: commit and push the verified corrective slice, update Draft PR #2 and the Linear receipt truthfully, present the final running UI/comparisons to the repository owner, and obtain explicit final visual acceptance. No merge or deployment is authorized.
