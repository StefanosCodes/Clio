import type {
  ConversationDetail,
  ConversationView,
  PacketView,
  StreamEvent,
} from "@clio/api-client";

import { parseEventStream } from "./parseEventStream";

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

export const organizationKey = (organizationId: string, ...parts: unknown[]) =>
  ["organization", organizationId, ...parts] as const;

async function request<T>(
  path: string,
  organizationId: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-clio-organization": organizationId,
      ...init.headers,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as unknown;
    throw Object.assign(new Error(`Clio API returned ${response.status}`), {
      status: response.status,
      payload,
    });
  }
  return (await response.json()) as T;
}

export const clioApi = {
  listConversations: (organizationId: string, signal?: AbortSignal) =>
    request<ConversationView[]>("/api/v1/conversations", organizationId, { signal }),

  createConversation: (organizationId: string, title: string) =>
    request<ConversationView>("/api/v1/conversations", organizationId, {
      method: "POST",
      body: JSON.stringify({ title }),
    }),

  getConversation: (
    organizationId: string,
    conversationId: string,
    signal?: AbortSignal,
  ) =>
    request<ConversationDetail>(
      `/api/v1/conversations/${conversationId}`,
      organizationId,
      { signal },
    ),

  updatePacket: (
    organizationId: string,
    conversationId: string,
    baseVersion: number,
    idempotencyKey: string,
    content: Record<string, unknown>,
  ) =>
    request<PacketView>(
      `/api/v1/conversations/${conversationId}/packet`,
      organizationId,
      {
        method: "PUT",
        body: JSON.stringify({
          base_version: baseVersion,
          idempotency_key: idempotencyKey,
          content,
        }),
      },
    ),

  streamTurn: async (
    organizationId: string,
    conversationId: string,
    input: {
      message: string;
      clientMessageId: string;
      afterCursor?: number;
      reconnectRunId?: string;
      retryOf?: string;
    },
    signal: AbortSignal,
    onEvent: (event: StreamEvent) => void,
  ) => {
    const response = await fetch(
      `${API_URL}/api/v1/conversations/${conversationId}/turns/stream`,
      {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          "x-clio-organization": organizationId,
        },
        body: JSON.stringify({
          message: input.message,
          client_message_id: input.clientMessageId,
          after_cursor: input.afterCursor ?? -1,
          reconnect_run_id: input.reconnectRunId ?? null,
          retry_of: input.retryOf ?? null,
          runtime: "fixture",
        }),
      },
    );
    if (!response.ok || !response.body) {
      throw new Error(`Stream unavailable (${response.status})`);
    }
    for await (const event of parseEventStream(response.body)) {
      onEvent(event as StreamEvent);
    }
  },

  cancelRun: (organizationId: string, runId: string) =>
    request<{ run_id: string; status: string }>(
      `/api/v1/runs/${runId}/cancel`,
      organizationId,
      { method: "POST", body: "{}" },
    ),
};
