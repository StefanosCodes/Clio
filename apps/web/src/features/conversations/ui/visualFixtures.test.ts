import { describe, expect, it } from "vitest";

import { resolveVisualFixture } from "./visualFixtures";

describe("visual fidelity fixtures", () => {
  it("are unavailable outside the development-only evidence boundary", () => {
    expect(resolveVisualFixture("?uiFixture=streaming", false)).toBeNull();
  });

  it.each([
    ["empty", 0, "idle"],
    ["populated", 2, "idle"],
    ["streaming", 2, "streaming"],
    ["disconnected", 2, "disconnected"],
    ["cancelled", 2, "cancelled"],
    ["failed", 2, "failed"],
    ["loading", 2, "idle"],
    ["packet", 2, "idle"],
    ["packet-drawer", 2, "idle"],
    ["packet-workspace", 2, "idle"],
    ["activity", 2, "streaming"],
  ] as const)("provides a deterministic %s state", (name, messageCount, status) => {
    const fixture = resolveVisualFixture(`?uiFixture=${name}`, true);
    expect(fixture?.name).toBe(name);
    expect(fixture?.session.messages).toHaveLength(messageCount);
    expect(fixture?.streamStatus).toBe(status);
    expect(fixture?.session.updatedAt).toBe(Date.UTC(2026, 7, 3, 12, 0, 0));
  });

  it("provides safe summarized activity for the dedicated right rail", () => {
    const message = resolveVisualFixture("?uiFixture=activity", true)?.session.messages.at(-1);
    expect(message).toMatchObject({
      status: "running",
      steps: [
        { title: "Reviewing conversation context" },
        { title: "Shaping the accepted outcome" },
      ],
      tools: [{ name: "search_knowledge_base", status: "completed" }],
    });
  });

  it("uses the real Rivet activity treatment for a streaming response", () => {
    const fixture = resolveVisualFixture("?uiFixture=streaming", true);
    expect(fixture?.session.messages.at(-1)).toMatchObject({
      role: "assistant",
      status: "running",
      content: "",
      steps: [{ title: "Shaping the outcome" }],
    });
  });

  it("contains a versioned packet only in the packet fixture", () => {
    expect(resolveVisualFixture("?uiFixture=packet", true)?.packet).toMatchObject({
      version: 2,
      content: { audience: "Acme Studio" },
    });
    expect(
      resolveVisualFixture("?uiFixture=packet-workspace", true)?.packet,
    ).toMatchObject({ version: 2 });
    expect(
      resolveVisualFixture("?uiFixture=packet-drawer", true)?.packet,
    ).toMatchObject({ version: 2 });
    expect(resolveVisualFixture("?uiFixture=populated", true)?.packet).toBeNull();
  });
});
