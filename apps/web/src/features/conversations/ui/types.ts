export type ActivityStep = { title: string };

export type ToolActivity = {
  name: string;
  status: "running" | "completed" | "failed";
  summary?: string | null;
};

export type ChatSource = {
  id: string;
  kind: "web" | "knowledge";
  provider: string;
  title: string;
  url?: string | null;
  description?: string | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  status: "queued" | "running" | "completed" | "failed";
  content: string;
  startedAt: number | null;
  finishedAt: number | null;
  steps: ActivityStep[];
  tools: ToolActivity[];
  sources: ChatSource[];
  error?: string | null;
};

export type ChatSession = {
  id: string;
  title: string;
  status: "active" | "archived";
  pinned: boolean;
  archivedAt: number | null;
  updatedAt: number;
  messages: ChatMessage[];
};

export type BuildPacket = {
  version: number;
  content: Record<string, unknown>;
};
