# STE-8 Codex-style workspace contract

Date: 2026-08-03

Status: owner-authorized; superseded in part by `ste-8-m1-ux-closeout.md`

## Authority

- Instruction class: adapt.
- Primary visual reference: repository-owner screenshots supplied in the STE-8 Codex task: `Screenshot 2026-08-03 at 3.00.01 PM.png` and `Screenshot 2026-08-03 at 3.00.08 PM.png`.
- Precedence: this latest owner direction supersedes the prior drawer-first Packet layout in `ste-8-chat-centered-interaction.md`.
- Implementation authority: Clio's existing React, API, durable Packet versioning, and accessibility contracts.
- Explicit non-goals: no real model claim, no tenant/auth expansion, no new persistence model, and no private reasoning display.

## Decision

The desktop chat route becomes a friendly, Codex-style split workspace:

```text
compact top-left navigation | resizable conversation pane | persistent plan/content pane
```

- Navigation is a compact icon rail at the far left. Its first control expands the existing navigation and recent-chat list when needed.
- Conversation is anchored to the left of the work area, with its transcript and composer sharing a single pane.
- Build Packet opens as a secondary content document after the user selects its in-thread artifact action. Saved Packets are readable Markdown documents and are not edited in M1.
- A draggable, keyboard-accessible separator changes the left-pane width. The preference is local UI state; it does not change a conversation or Packet record.
- The first Packet remains a normal durable artifact: its in-thread create action goes through the existing versioned API mutation.
- Activity remains safe summarized UI. It may temporarily occupy the contextual detail surface only after the user explicitly opens it; it never exposes private reasoning.
- On narrow screens, the conversation remains primary and content opens as a full-width sheet rather than creating two unusably narrow columns.

## Surface matrix

| Reference element | Clio target | Classification | Evidence required |
| --- | --- | --- | --- |
| Narrow icon column at top left | Collapsed Clio navigation rail | adapted | desktop capture and keyboard/click test |
| Side-by-side conversation and document | resizable chat/Packet workspace | adapted | desktop capture, drag/keyboard test |
| Document opens beside chat | secondary read-only Build Packet pane | adapted | real browser create/open/reload flow |
| Divider between work areas | accessible layout separator | adapted | pointer and keyboard behavior test |
| Small-screen content treatment | full-width Packet sheet | adapted | mobile capture and close behavior |
| Existing Rivet transcript/composer language | unchanged inside the left conversation pane | retained | chat state regression suite |

## Capture conditions

| Surface | Viewport | Theme | Required state |
| --- | --- | --- | --- |
| Split workspace | 1440×900 | dark and light | populated chat + saved Packet |
| Split workspace | 1440×900 | dark | divider moved toward chat and toward Packet |
| Empty Packet content pane | 1440×900 | light | create action available |
| Responsive content | 390×844 | dark and light | Packet sheet overlays conversation |
| Activity | 1440×900 | dark | safe activity detail, explicit open only |

## Acceptance criteria

1. At desktop width, opening the Build Packet presents conversation and document side by side; chat remains primary before that action.
2. The separator can be dragged, and has accessible semantics plus keyboard adjustment.
3. Creating a Packet from its in-thread action persists version 1; opening a saved Packet renders the exact accepted content without an edit form.
4. The compact left rail can reveal the existing navigation without losing current conversation identity.
5. Mobile never compresses chat and Packet into side-by-side slivers.
6. The old permanent drawer geometry is not presented as the default workspace.

## Explicit visual deviation

The prior Rivet full-width centered-chat shell is intentionally replaced for the desktop chat route. This is owner-authorized by the supplied Codex screenshots and is tracked as a Clio product-contract change, not as silent Rivet parity.
