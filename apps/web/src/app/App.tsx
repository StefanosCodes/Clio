import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useReducer, useState } from "react";
import { BrowserRouter, useNavigate } from "react-router";

import {
  FixtureOrganizationProvider,
  fixtureOrganizations,
  useFixtureOrganization,
} from "../entities/organization/FixtureOrganizationContext";
import {
  initialStreamState,
  streamReducer,
} from "../features/conversations/model/streamReducer";
import { clioApi, organizationKey } from "../shared/api/clioApi";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5_000 },
    mutations: { retry: false },
  },
});

const shortcuts = [
  {
    label: "Plan new work",
    prompt: "Help me shape a new product outcome into a clear plan.",
  },
  {
    label: "Turn context into work",
    prompt: "Turn the context I share into concrete, reviewable work.",
  },
  {
    label: "Improve existing work",
    prompt: "Help me improve an existing piece of work without losing its intent.",
  },
] as const;

function Shell() {
  const {
    organizationId,
    organizationName,
    scopeEpoch,
    registerAbort,
    switchOrganization,
  } = useFixtureOrganization();
  const navigate = useNavigate();
  const scopedQueryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [lastMessage, setLastMessage] = useState("");
  const [packetOpen, setPacketOpen] = useState(true);
  const [stream, dispatch] = useReducer(streamReducer, initialStreamState);

  const conversations = useQuery({
    queryKey: organizationKey(organizationId, "conversations"),
    queryFn: ({ signal }) => clioApi.listConversations(organizationId, signal),
  });

  useEffect(() => {
    setSelectedId(null);
    setDraft("");
    setLastMessage("");
    dispatch({ type: "reset" });
  }, [scopeEpoch]);

  useEffect(() => {
    if (!selectedId && conversations.data?.[0]) {
      setSelectedId(conversations.data[0].id);
      navigate(`/organizations/${organizationId}/conversations/${conversations.data[0].id}`, {
        replace: true,
      });
    }
  }, [conversations.data, navigate, organizationId, selectedId]);

  const detail = useQuery({
    queryKey: organizationKey(organizationId, "conversation", selectedId),
    queryFn: ({ signal }) =>
      clioApi.getConversation(organizationId, selectedId as string, signal),
    enabled: Boolean(selectedId),
  });

  const createConversation = useMutation({
    mutationFn: () =>
      clioApi.createConversation(organizationId, "Untitled planning conversation"),
    onSuccess: async (conversation) => {
      await scopedQueryClient.invalidateQueries({
        queryKey: organizationKey(organizationId, "conversations"),
      });
      setSelectedId(conversation.id);
      navigate(`/organizations/${organizationId}/conversations/${conversation.id}`);
    },
  });

  const updatePacket = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error("Select a conversation first");
      const baseVersion = detail.data?.packet?.version ?? 0;
      return clioApi.updatePacket(
        organizationId,
        selectedId,
        baseVersion,
        crypto.randomUUID(),
        {
          outcome: "A reviewed, version-bound Build Packet",
          audience: organizationName,
          status: "Fixture — planning intelligence arrives after M1",
          source_conversation: selectedId,
        },
      );
    },
    onSuccess: async () => {
      await scopedQueryClient.invalidateQueries({
        queryKey: organizationKey(organizationId, "conversation", selectedId),
      });
    },
  });

  const selectConversation = (conversationId: string) => {
    dispatch({ type: "reset" });
    setSelectedId(conversationId);
    navigate(`/organizations/${organizationId}/conversations/${conversationId}`);
  };

  const send = async (message = draft, reconnect = false) => {
    if (!selectedId || (!message.trim() && !reconnect)) return;
    const controller = new AbortController();
    const unregister = registerAbort(controller);
    if (!reconnect) {
      setLastMessage(message.trim());
      setDraft("");
      dispatch({ type: "reset" });
    }
    try {
      await clioApi.streamTurn(
        organizationId,
        selectedId,
        {
          message: reconnect ? lastMessage : message.trim(),
          clientMessageId: reconnect
            ? `reconnect-${stream.runId}`
            : crypto.randomUUID(),
          afterCursor: reconnect ? stream.cursor : -1,
          reconnectRunId: reconnect ? stream.runId ?? undefined : undefined,
        },
        controller.signal,
        (event) => dispatch({ type: "event", event }),
      );
      await Promise.all([
        scopedQueryClient.invalidateQueries({
          queryKey: organizationKey(organizationId, "conversation", selectedId),
        }),
        scopedQueryClient.invalidateQueries({
          queryKey: organizationKey(organizationId, "conversations"),
        }),
      ]);
    } catch (error) {
      if (!controller.signal.aborted) {
        dispatch({
          type: "transport-error",
          message: error instanceof Error ? error.message : "Stream disconnected",
        });
      }
    } finally {
      unregister();
    }
  };

  const cancel = async () => {
    if (!stream.runId) return;
    await clioApi.cancelRun(organizationId, stream.runId);
    dispatch({
      type: "event",
      event: {
        schema_version: "1.0.0",
        event: "done",
        run_id: stream.runId,
        cursor: stream.cursor + 1,
        created_at: new Date().toISOString(),
        status: "cancelled",
      },
    });
  };

  const messages = detail.data?.messages ?? [];
  const latestRun = detail.data?.runs.at(-1);
  const savedStatus = latestRun?.status ?? "idle";
  const statusLabel = useMemo(() => {
    if (stream.status === "streaming") return "Thinking in this tab";
    if (stream.status === "disconnected") return "Disconnected — reconnect available";
    if (savedStatus === "completed") return "Saved conversation — no worker running";
    if (savedStatus === "cancelled") return "Last turn canceled";
    return "Ready";
  }, [savedStatus, stream.status]);

  return (
    <div className="app-shell">
      <aside className="conversation-rail">
        <div className="brand-lockup">
          <span className="brand-mark">C</span>
          <div>
            <strong>Clio</strong>
            <span>Idea to accepted work</span>
          </div>
        </div>

        <label className="organization-picker">
          <span>Fixture organization</span>
          <select
            aria-label="Fixture organization"
            value={organizationId}
            onChange={(event) => void switchOrganization(event.target.value)}
          >
            {fixtureOrganizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>
        <p className="fixture-badge">Fixture authority · M1 only</p>

        <button
          className="new-conversation"
          type="button"
          onClick={() => createConversation.mutate()}
          disabled={createConversation.isPending}
        >
          <span>＋</span> New conversation
        </button>

        <nav className="conversation-list" aria-label="Conversations">
          {conversations.isLoading && <p className="rail-state">Loading conversations…</p>}
          {conversations.isError && (
            <button className="rail-state error-state" onClick={() => void conversations.refetch()}>
              Couldn’t load. Retry
            </button>
          )}
          {conversations.data?.map((conversation) => (
            <button
              type="button"
              key={conversation.id}
              className={conversation.id === selectedId ? "conversation active" : "conversation"}
              onClick={() => selectConversation(conversation.id)}
            >
              <span>{conversation.title}</span>
              <small>{new Date(conversation.updated_at).toLocaleDateString()}</small>
            </button>
          ))}
        </nav>

        <div className="rail-footer">
          <span className="avatar">SS</span>
          <div><strong>Stefanos</strong><small>Development workspace</small></div>
        </div>
      </aside>

      <main className="chat-workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">{organizationName}</p>
            <h1>{detail.data?.conversation.title ?? "What should we shape next?"}</h1>
          </div>
          <div className="run-state"><span />{statusLabel}</div>
        </header>

        <section className="message-stage" aria-live="polite">
          {!selectedId && !conversations.isLoading ? (
            <div className="empty-state">
              <span className="empty-orbit">✦</span>
              <h2>Start with the outcome.</h2>
              <p>Create a conversation, then describe the change you want in plain language.</p>
              <button type="button" onClick={() => createConversation.mutate()}>
                Create your first conversation
              </button>
            </div>
          ) : null}
          {detail.isLoading && <div className="message-skeleton">Reopening saved history…</div>}
          {detail.isError && (
            <div className="inline-error">
              Saved history is unavailable. <button onClick={() => void detail.refetch()}>Retry</button>
            </div>
          )}
          <div className="message-list">
            {messages.map((message) => (
              <article key={message.id} className={`message ${message.role}`}>
                <span className="message-author">{message.role === "user" ? "You" : "Clio"}</span>
                <p>{message.content}</p>
              </article>
            ))}
            {stream.text && stream.status !== "completed" ? (
              <article className="message assistant live-message">
                <span className="message-author">Clio · live</span>
                <p>{stream.text}</p>
              </article>
            ) : null}
          </div>
          {stream.status === "disconnected" && (
            <div className="inline-error">
              {stream.error} <button onClick={() => void send(lastMessage, true)}>Reconnect</button>
            </div>
          )}
          {stream.status === "cancelled" && (
            <div className="inline-error neutral">
              Turn canceled. <button onClick={() => void send(lastMessage)}>Retry turn</button>
            </div>
          )}
        </section>

        <section className="composer-dock">
          <div className="shortcuts" aria-label="Planning shortcuts">
            {shortcuts.map((shortcut) => (
              <button key={shortcut.label} type="button" onClick={() => setDraft(shortcut.prompt)}>
                {shortcut.label}
              </button>
            ))}
          </div>
          <div className="composer">
            <textarea
              aria-label="Message Clio"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="Describe the outcome, context, or work you want to improve…"
              disabled={!selectedId || stream.status === "streaming"}
            />
            {stream.status === "streaming" ? (
              <button className="send-button cancel" type="button" onClick={() => void cancel()}>
                Stop
              </button>
            ) : (
              <button
                className="send-button"
                type="button"
                disabled={!selectedId || !draft.trim()}
                onClick={() => void send()}
              >
                Send <span>↗</span>
              </button>
            )}
          </div>
          <p className="composer-note">Enter to send · Shift + Enter for a new line</p>
        </section>
      </main>

      <aside className={packetOpen ? "packet-panel" : "packet-panel collapsed"}>
        <button className="packet-toggle" type="button" onClick={() => setPacketOpen(!packetOpen)}>
          <span>Build Packet</span><span>{packetOpen ? "→" : "←"}</span>
        </button>
        {packetOpen && (
          <div className="packet-content">
            <div className="packet-heading">
              <span className="packet-icon">▤</span>
              <div><h2>Build Packet</h2><p>Live fixture artifact</p></div>
            </div>
            {detail.data?.packet ? (
              <>
                <div className="packet-version">Version {detail.data.packet.version} · saved</div>
                {Object.entries(detail.data.packet.content).map(([key, value]) => (
                  <section className="packet-section" key={key}>
                    <h3>{key.replaceAll("_", " ")}</h3>
                    <p>{String(value)}</p>
                  </section>
                ))}
              </>
            ) : (
              <div className="packet-empty">
                <span>◇</span>
                <h3>No packet snapshot yet</h3>
                <p>M1 uses a versioned fixture to prove the artifact boundary.</p>
              </div>
            )}
            <button
              className="packet-action"
              type="button"
              disabled={!selectedId || updatePacket.isPending}
              onClick={() => updatePacket.mutate()}
            >
              {detail.data?.packet ? "Create next fixture version" : "Create fixture packet"}
            </button>
            {updatePacket.isError && (
              <p className="packet-error">Version conflict or save failure. Reload before retrying.</p>
            )}
            <div className="packet-boundary">
              <strong>Evaluation boundary</strong>
              <p>Planning quality is not claimed in M1. STE-37 adds executable evidence.</p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <FixtureOrganizationProvider>
          <Shell />
        </FixtureOrganizationProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
