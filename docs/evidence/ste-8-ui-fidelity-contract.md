# STE-8 Rivet UI fidelity contract

Date: 2026-08-03
Status: representative screen accepted; full 17-state production-parity evidence complete; final owner visual acceptance pending
Instruction class: clone/port
Design authority: repository owner through the launched corrective `/goal`

## Authority

- Primary reference: [`StefanosCodes/Rivet`](https://github.com/StefanosCodes/Rivet/tree/cf116a9968d59f2c72b900cbc42a5f3ab5a9acf4) at commit `cf116a9968d59f2c72b900cbc42a5f3ab5a9acf4`.
- Verified tree: `6773c9cc463c92ba709c4663fd0bcd4c268b162d`.
- Authoritative paths:
  - `examples/chat-agent/frontend`
  - `packages/react/src/components`
  - `packages/react/src/styles.css`
- Reference precedence: the exact committed source and its rendered fixture outrank the prior Clio screenshot and the prior completion receipt's visual claim.
- Approved adaptation boundary: Clio data, API, URL, organization, stream/run, and Build Packet behavior may replace Rivet internals while retaining Rivet's observable presentation and interaction language.
- Explicit non-goals: redesign, new palette, permanent third column, Rivet persistence, service-role REST access, knowledge ingestion, plugin execution, generic registries, or recovery of omitted upstream business logic.

The prior `docs/evidence/ste-8-shell.png` proves that the functional Clio shell ran. It is not reference-fidelity evidence and is superseded for visual acceptance by this corrective gate.

## Source integrity and fixture-harness boundary

The accepted checkout reproduces the recorded commit and tree. `npm ci` passes with 0 vulnerabilities. `npm run verify:frontend` stops during `check:react` because the accepted tree omits `packages/react/src/lib/chat-state`, `packages/react/src/lib/catalog`, and the example knowledge client. These are state/data modules; the shell, components, and complete 2,343-line stylesheet remain present.

The reference may therefore be rendered with a minimal fixture-only harness that supplies inert types/data and preserves the committed JSX, CSS, icons, themes, geometry, and responsive behavior. The harness is evidence tooling, not recovered Rivet runtime behavior. It must not fill a visual gap by invention.

Reference file SHA-256 values:

| File | SHA-256 |
| --- | --- |
| `examples/chat-agent/frontend/src/App.tsx` | `e6086d64b1e183c66f72afccf0b5fcbfe69b96f57eea117724884ab479b19352` |
| `examples/chat-agent/frontend/src/components/sidebar.tsx` | `633c3283f266b6bf4e26dd4d1b5824b1119350384bd62004f88f7f33143ff3f0` |
| `packages/react/src/components/chat-view.tsx` | `60e82ae6e5aaa8e04b211f2e8a0b5fec6e90a8038fccd31f403dfba9a4b7bb0d` |
| `packages/react/src/components/prompt-composer.tsx` | `09f5e92b9a2c4ed1afb06f74aea63a6874f8fd900cf0e39101775b935850ece4` |
| `packages/react/src/components/agent-activity.tsx` | `95927029be2879d8c0518d7f1e6eb8709ac0952bdb90a7bcdc33235d98f9d419` |
| `packages/react/src/components/brand-icon.tsx` | `5a2f25f7d33399111983cd9b809c5d02c05dbd69a79e33bafb1cc23a0325d682` |
| `packages/react/src/styles.css` | `baae899258411150efaf4406a0a4c7a4287a92ac755a594f9f0e6f5af23ac233` |

## Capture conditions

| Surface | Viewport | Theme | Fixture/content | Required states |
| --- | --- | --- | --- | --- |
| Representative desktop | 1440×900, DPR 1 | dark and light | deterministic empty chat | expanded sidebar, empty chat, composer |
| Compact desktop | 1280×800, DPR 1 | dark | deterministic populated chat | recent chats, user/assistant messages, compact composer |
| Mobile | 390×844, DPR 1 | dark and light | deterministic empty and populated chat | closed/open navigation, header, composer |
| Recovery states | 1440×900, DPR 1 | dark | deterministic Clio state fixtures | streaming/thinking, disconnected, canceled, retry/error |
| Detail surfaces | 1440×900, DPR 1 | dark | deterministic packet/activity fixtures | Rivet-style right drawer and close behavior |

All comparisons use the same local Chromium build, operating system, font availability, viewport, DPR, color scheme, reduced-motion setting, fixture strings, animation state, and full-page bounds. Dynamic identifiers and timestamps may be normalized in fixture data; layout, typography, colors, icons, component geometry, and navigation may not be masked. The capture runner fast-forwards CSS animation/transition state at screenshot time; its additional freeze stylesheet is intentionally omitted because applying it after navigation freezes width transitions at an intermediate frame.

## Reference token inventory

- Typography: `"OpenAI Sans", ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`; default chat copy 16 px; empty-chat heading 32 px desktop and 27 px mobile.
- Light colors: background/surface `#ffffff`, foreground `#171717`, sidebar `#f7f7f7`, composer/muted `#f4f4f4`, border `#e4e4e4`, bubble `#eeeeee`, accent `#159a76`.
- Dark colors: background/sidebar/surface `#000000`, foreground `#f5f5f5`, composer `#212121`, border `#262626`, bubble `#2f2f2f`, accent `#ffffff`.
- Shell geometry: flexible two-region shell; sidebar 260 px expanded and 64 px collapsed; 56 px app header; chat content width 768 px; detail drawer `clamp(360px, 34vw, 440px)`.
- Component geometry: sidebar controls 7 px radius; empty composer 26 px radius and 124 px minimum height; compact composer 29 px radius and 58 px minimum height; user bubble 20 px radius.
- Iconography: `lucide-react`, generally 1.8 stroke width in navigation and composer controls.
- Motion: 160–180 ms sidebar/drawer transitions, pulsing stream indicator, text shimmer for thinking; reduced-motion override required.
- Breakpoints: mobile shell at 760 px; narrow content adjustments at 460 px.

## Surface matrix

| Reference element | Clio target | Classification | Required evidence | Remaining difference | Authority |
| --- | --- | --- | --- | --- | --- |
| Rivet wordmark/header | Clio brand in identical shell geometry | adapted | same-condition desktop/mobile captures | Text changes from Rivet to Clio only | Product contract |
| Expanded/collapsed sidebar | Conversation/navigation rail | adapted | captures plus collapse interaction | Clio conversations replace Rivet sessions | Goal |
| New Chat, Knowledge Base, Plugins navigation | New conversation plus in-scope Clio navigation | adapted/deferred | surface capture and matrix | Deferred items may remain visibly unavailable; no invented styling | M1 scope |
| Recent chats and row menu | Durable Clio conversations | adapted | populated capture plus functional test | Backend/state only | Goal |
| Empty chat | Clio empty conversation | exact presentation | desktop/mobile light/dark diff | Required Clio copy may differ only if recorded | Goal |
| Prompt composer and action menu | Clio turn composer and shortcuts | adapted | empty/compact/menu captures | Clio shortcuts replace unavailable Rivet actions inside same patterns | Product contract |
| User/assistant messages | Durable Clio messages | exact presentation | populated diff | Data only | Goal |
| Thinking/activity | Clio streaming status | adapted | streaming capture and reducer test | Clio events mapped to same presentation | Goal |
| Theme control | Clio theme control | exact | light/dark captures | None | Goal |
| Mobile drawer/sidebar | Clio mobile navigation | exact presentation | 390×844 captures and interaction | Data only | Goal |
| Run detail drawer | Build Packet/activity detail surface | adapted | drawer capture and behavior | Content is Clio Build Packet; Rivet drawer language remains | Goal |
| Organization selector | Workspace/account area | adapted | two-org captures and isolation test | Fixture authority label retained without new visual system | Goal |
| Loading/error/disconnected/canceled/retry | Clio lifecycle states | adapted | deterministic state captures and tests | Status semantics are Clio-owned | STE-8 contract |

No row classified `different` is currently authorized.

## Representative-screen result

The immutable, unadapted Rivet captures remain the primary visual reference. A second normalized reference fixture changes only the authorized product strings and organization/account fixture (`Rivet` → `Clio`, `Message Rivet` → `Message Clio`, and the fixture organization footer). It uses the same committed Rivet JSX, CSS, icons, and geometry. The Clio capture uses a development-only `uiFixture=empty` query to suppress durable conversation data; it does not alter production output.

| Condition | SSIM | Perceptual mismatch | Classification |
| --- | ---: | ---: | --- |
| Desktop 1440×900 dark | 0.999962 | 0.00031% | production-parity |
| Desktop 1440×900 light | 0.999961 | 0.00023% | production-parity |
| Mobile 390×844 dark | 0.999207 | 0.01489% | production-parity |
| Mobile 390×844 light | 0.999302 | 0.01489% | production-parity |

The remaining mobile pixels are confined to the authorized header icon/string substitution. No geometry, palette, type, composer, navigation, or breakpoint difference remains above the contract threshold.

The repository owner accepted this representative result in the corrective Codex task with: “Yes very much so continue.” That approval cleared the early representative-screen gate and authorized completion of the full state migration. It does not replace the separate final visual acceptance required before STE-8 returns to Done.

## Full-state result

The repository-owned runner now compares 17 desktop/mobile, light/dark, conversation, lifecycle, navigation, and drawer states with no masks. Every state passes the predeclared production-parity threshold. Exact metrics and links to the reference, implementation, and diff artifacts are recorded in [`ste-8-ui-fidelity-report.md`](./ste-8-ui-fidelity-report.md) and its machine-readable [`report.json`](./ui-fidelity/regression-current/report.json).

## Verification contract

- Reference captures: complete for the immutable representative fixture and all 17 normalized required-state fixtures.
- Implementation captures: complete for all 17 matching desktop/mobile, light/dark, conversation, lifecycle, navigation, and drawer conditions.
- Comparison: exact pixel mismatch plus perceptual mismatch, SSIM, overlay, and top-error inspection. Default production-parity reporting requires SSIM ≥ 0.999 and perceptual mismatch ≤ 0.1%; exact means zero normalized RGB differences.
- Functional checks: frontend tests/type/build, backend tests, Postgres integration, browser create/switch/stream/reconnect/cancel/retry/packet/organization flows.
- Accessibility checks: semantic roles/names, keyboard access, focus visibility, reduced motion, responsive navigation.
- User visual acceptance: representative-screen gate accepted; final repaired-UI acceptance is still required before STE-8 returns to Done.

## Stop record

- Resolved: the missing upstream state/catalog modules do not remove the visual source; use an inert fixture-only harness.
- Stop if a committed visual element cannot be rendered or inferred from the exact source without creative invention.
- Stop before retaining the current sage/beige palette, permanent packet column, or any other unapproved deviation.
