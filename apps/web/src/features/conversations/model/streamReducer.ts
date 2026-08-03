import type { StreamEvent } from "@clio/api-client";

export type StreamState = {
  status: "idle" | "streaming" | "disconnected" | "completed" | "failed" | "cancelled";
  runId: string | null;
  cursor: number;
  text: string;
  error: string | null;
};

export const initialStreamState: StreamState = {
  status: "idle",
  runId: null,
  cursor: -1,
  text: "",
  error: null,
};

export type StreamAction =
  | { type: "reset" }
  | { type: "event"; event: StreamEvent }
  | { type: "transport-error"; message: string };

export function streamReducer(state: StreamState, action: StreamAction): StreamState {
  if (action.type === "reset") return initialStreamState;
  if (action.type === "transport-error") {
    return { ...state, status: "disconnected", error: action.message };
  }
  const event = action.event;
  if (event.cursor <= state.cursor) return state;
  if (event.cursor > state.cursor + 1) {
    return {
      ...state,
      status: "disconnected",
      error: `Missing stream event after cursor ${state.cursor}`,
    };
  }
  const next = { ...state, cursor: event.cursor, runId: event.run_id };
  switch (event.event) {
    case "session":
      return { ...next, status: "streaming", error: null };
    case "text_delta":
      return { ...next, text: state.text + event.delta };
    case "error":
      return { ...next, status: "failed", error: event.message };
    case "done":
      return { ...next, status: event.status, error: null };
    default:
      return next;
  }
}
