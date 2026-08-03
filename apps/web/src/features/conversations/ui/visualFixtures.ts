import type { ChatSession } from "./types";

export type VisualFixtureName =
  | "empty"
  | "populated"
  | "streaming"
  | "disconnected"
  | "cancelled"
  | "failed"
  | "loading"
  | "packet"
  | "packet-drawer"
  | "packet-workspace"
  | "activity";

export type VisualFixture = {
  name: VisualFixtureName;
  session: ChatSession;
  sessions: ChatSession[];
  streamStatus:
    | "idle"
    | "streaming"
    | "disconnected"
    | "completed"
    | "failed"
    | "cancelled";
  streamError: string | null;
  loading: boolean;
  packet:
    | {
        version: number;
        content: Record<string, unknown>;
      }
    | null;
};

const capturedAt = Date.UTC(2026, 7, 3, 12, 0, 0);

const userMessage = {
  id: "fixture-user",
  role: "user" as const,
  status: "completed" as const,
  content: "Help me turn this outcome into clear, accepted work.",
  startedAt: capturedAt,
  finishedAt: capturedAt,
  steps: [],
  tools: [],
  sources: [],
};

const completedAssistantMessage = {
  id: "fixture-assistant",
  role: "assistant" as const,
  status: "completed" as const,
  content:
    "I captured that direction. The outcome, constraints, and acceptance evidence are ready to shape into a Build Packet.",
  startedAt: capturedAt + 1_000,
  finishedAt: capturedAt + 4_000,
  steps: [],
  tools: [],
  sources: [],
};

function session(
  name: VisualFixtureName,
  messages: ChatSession["messages"],
): ChatSession {
  return {
    id: `fixture-${name}`,
    title: name === "empty" ? "New Chat" : "Shape the accepted outcome",
    status: "active",
    pinned: false,
    archivedAt: null,
    updatedAt: capturedAt,
    messages,
  };
}

export function resolveVisualFixture(
  search: string,
  enabled: boolean,
): VisualFixture | null {
  if (!enabled) return null;
  const requested = new URLSearchParams(search).get("uiFixture");
  const names: VisualFixtureName[] = [
    "empty",
    "populated",
    "streaming",
    "disconnected",
    "cancelled",
    "failed",
    "loading",
    "packet",
    "packet-drawer",
    "packet-workspace",
    "activity",
  ];
  if (!names.includes(requested as VisualFixtureName)) return null;
  const name = requested as VisualFixtureName;

  let messages: ChatSession["messages"] = [];
  if (["populated", "packet", "packet-drawer", "packet-workspace", "cancelled", "loading"].includes(name)) {
    messages = [userMessage, completedAssistantMessage];
  } else if (name === "streaming" || name === "activity") {
    messages = [
      userMessage,
      {
        ...completedAssistantMessage,
        id: "fixture-assistant-streaming",
        status: "running",
        content: "",
        startedAt: name === "activity" ? null : completedAssistantMessage.startedAt,
        finishedAt: null,
        steps:
          name === "activity"
            ? [
                { title: "Reviewing conversation context" },
                { title: "Shaping the accepted outcome" },
              ]
            : [{ title: "Shaping the outcome" }],
        tools:
          name === "activity"
            ? [
                {
                  name: "search_knowledge_base",
                  status: "completed",
                  summary: "Reviewed the delivery boundary",
                },
              ]
            : [],
        sources:
          name === "activity"
            ? [
                {
                  id: "fixture-source",
                  kind: "knowledge",
                  provider: "Clio",
                  title: "Accepted delivery boundary",
                  description: "Authorized fixture context for the M1 planning shell.",
                },
              ]
            : [],
      },
    ];
  } else if (name === "disconnected") {
    messages = [
      userMessage,
      {
        ...completedAssistantMessage,
        id: "fixture-assistant-disconnected",
        status: "failed",
        content: "I captured the outcome and started shaping",
        finishedAt: null,
        error: "Connection interrupted. The saved run can be reconnected.",
      },
    ];
  } else if (name === "failed") {
    messages = [
      userMessage,
      {
        ...completedAssistantMessage,
        id: "fixture-assistant-failed",
        status: "failed",
        content: "",
        error: "The fixture turn failed before a response was saved.",
      },
    ];
  }

  const active = session(name, messages);
  const prior = {
    ...session("populated", [userMessage, completedAssistantMessage]),
    id: "fixture-prior",
    title: "Review the delivery boundary",
    updatedAt: capturedAt - 60_000,
  };
  const streamStatus =
    name === "streaming" || name === "activity"
      ? "streaming"
      : name === "disconnected"
        ? "disconnected"
        : name === "cancelled"
          ? "cancelled"
          : name === "failed"
            ? "failed"
            : "idle";

  return {
    name,
    session: active,
    sessions: name === "empty" ? [] : [active, prior],
    streamStatus,
    streamError:
      name === "disconnected"
        ? "Connection interrupted. The saved run can be reconnected."
        : name === "failed"
          ? "The fixture turn failed before a response was saved."
          : null,
    loading: name === "loading",
    packet:
      name === "packet" || name === "packet-drawer" || name === "packet-workspace"
        ? {
            version: 2,
            content: {
              outcome: "A reviewed, version-bound Build Packet",
              audience: "Acme Studio",
              status: "Draft",
            },
          }
        : null,
  };
}
