import { describe, expect, it } from "vitest";

import { initialStreamState, streamReducer } from "./streamReducer";

const base = {
  schema_version: "1.0.0" as const,
  run_id: "run-1",
  created_at: "2026-08-03T00:00:00Z",
};

describe("streamReducer", () => {
  it("deduplicates replayed cursors and never duplicates partial text", () => {
    const session = { ...base, event: "session" as const, runtime: "fixture" as const, cursor: 0 };
    const delta = { ...base, event: "text_delta" as const, delta: "Hello", cursor: 1 };
    const started = streamReducer(initialStreamState, { type: "event", event: session });
    const once = streamReducer(started, { type: "event", event: delta });
    const replayed = streamReducer(once, { type: "event", event: delta });
    expect(replayed.text).toBe("Hello");
    expect(replayed.cursor).toBe(1);
  });

  it("exposes a gap instead of accepting out-of-order data", () => {
    const event = { ...base, event: "text_delta" as const, delta: "late", cursor: 2 };
    const state = streamReducer(initialStreamState, { type: "event", event });
    expect(state.status).toBe("disconnected");
    expect(state.text).toBe("");
  });

  it("preserves partial text when transport disconnects so replay can resume", () => {
    const session = { ...base, event: "session" as const, runtime: "fixture" as const, cursor: 0 };
    const delta = { ...base, event: "text_delta" as const, delta: "Partial", cursor: 1 };
    const started = streamReducer(initialStreamState, { type: "event", event: session });
    const partial = streamReducer(started, { type: "event", event: delta });
    const disconnected = streamReducer(partial, {
      type: "transport-error",
      message: "connection reset",
    });
    expect(disconnected).toMatchObject({
      status: "disconnected",
      cursor: 1,
      text: "Partial",
      error: "connection reset",
    });
  });

  it("reconciles terminal canceled and failed events", () => {
    const session = { ...base, event: "session" as const, runtime: "fixture" as const, cursor: 0 };
    const started = streamReducer(initialStreamState, { type: "event", event: session });
    const cancelled = streamReducer(started, {
      type: "event",
      event: { ...base, event: "done", cursor: 1, status: "cancelled" },
    });
    expect(cancelled.status).toBe("cancelled");

    const failed = streamReducer(started, {
      type: "event",
      event: {
        ...base,
        event: "error",
        cursor: 1,
        code: "FixtureFailure",
        message: "failed",
        retryable: true,
      },
    });
    expect(failed).toMatchObject({ status: "failed", error: "failed" });
  });
});
