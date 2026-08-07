import type { components } from "./schema";

export type ConversationView = components["schemas"]["ConversationView"];
export type ConversationDetail = components["schemas"]["ConversationDetail"];
export type MessageView = components["schemas"]["MessageView"];
export type PacketView = components["schemas"]["PacketView"];
export type RunView = components["schemas"]["RunView"];
export type StreamEvent =
  | components["schemas"]["SessionEvent"]
  | components["schemas"]["StatusEvent"]
  | components["schemas"]["TextDeltaEvent"]
  | components["schemas"]["UsageEvent"]
  | components["schemas"]["ErrorEvent"]
  | components["schemas"]["DoneEvent"];
