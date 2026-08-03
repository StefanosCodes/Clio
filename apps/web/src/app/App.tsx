import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
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
import { planningSkills } from "../features/conversations/ui/catalog";
import { ChatView } from "../features/conversations/ui/ChatView";
import { Sidebar, type AppView } from "../features/conversations/ui/Sidebar";
import type {
  ChatMessage,
  ChatSession,
} from "../features/conversations/ui/types";
import { resolveVisualFixture } from "../features/conversations/ui/visualFixtures";
import { clioApi, organizationKey } from "../shared/api/clioApi";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5_000 },
    mutations: { retry: false },
  },
});

type Theme = "dark" | "light";

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
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const match = window.location.pathname.match(
      /^\/organizations\/([^/]+)\/conversations\/([^/]+)/,
    );
    return match?.[1] === organizationId ? match[2] : null;
  });
  const [lastMessage, setLastMessage] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<ChatMessage | null>(null);
  const [packetOpen, setPacketOpen] = useState(false);
  const [activeView, setActiveView] = useState<AppView>(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    return import.meta.env.DEV && (requested === "knowledge" || requested === "plugins")
      ? requested
      : "chat";
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () =>
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get("collapsed") === "1",
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(
    () =>
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get("mobile") === "open",
  );
  const [theme, setTheme] = useState<Theme>(() => {
    const requested = new URLSearchParams(window.location.search).get("theme");
    if (requested === "light" || requested === "dark") return requested;
    const saved = window.localStorage.getItem("clio-theme");
    return saved === "light" ? "light" : "dark";
  });
  const [stream, dispatch] = useReducer(streamReducer, initialStreamState);
  const activeStreamController = useRef<AbortController | null>(null);
  const observedScopeEpoch = useRef(scopeEpoch);
  const [visualFixture] = useState(() =>
    resolveVisualFixture(window.location.search, import.meta.env.DEV),
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("clio-theme", theme);
  }, [theme]);

  const conversations = useQuery({
    queryKey: organizationKey(organizationId, "conversations"),
    queryFn: ({ signal }) => clioApi.listConversations(organizationId, signal),
    enabled: !visualFixture,
  });

  useEffect(() => {
    if (observedScopeEpoch.current === scopeEpoch) return;
    observedScopeEpoch.current = scopeEpoch;
    setSelectedId(null);
    setLastMessage("");
    setPendingUserMessage(null);
    setPacketOpen(false);
    if (!visualFixture) setActiveView("chat");
    dispatch({ type: "reset" });
  }, [scopeEpoch, visualFixture]);

  useEffect(() => {
    if (visualFixture?.name === "packet") setPacketOpen(true);
  }, [visualFixture]);

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
    enabled: Boolean(selectedId) && !visualFixture,
  });

  const createConversation = useMutation({
    mutationFn: () => clioApi.createConversation(organizationId, "New planning conversation"),
    onSuccess: async (conversation) => {
      await scopedQueryClient.invalidateQueries({
        queryKey: organizationKey(organizationId, "conversations"),
      });
      setSelectedId(conversation.id);
      setActiveView("chat");
      setMobileSidebarOpen(false);
      setPendingUserMessage(null);
      dispatch({ type: "reset" });
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
    setPendingUserMessage(null);
    setSelectedId(conversationId);
    setActiveView("chat");
    setMobileSidebarOpen(false);
    navigate(`/organizations/${organizationId}/conversations/${conversationId}`);
  };

  const latestPersistedRun = detail.data?.runs.at(-1);
  const persistedPrompt =
    detail.data?.messages.findLast((message) => message.role === "user")?.content ?? "";
  const recoveryRunId = stream.runId ?? latestPersistedRun?.id ?? null;
  const recoveryCursor = stream.runId ? stream.cursor : -1;

  const send = async (
    message: string,
    reconnect = false,
    retryOf?: string,
  ) => {
    const prompt = reconnect ? lastMessage || message.trim() : message.trim();
    if (!selectedId || !prompt || (reconnect && !recoveryRunId)) return;
    const controller = new AbortController();
    activeStreamController.current = controller;
    const unregister = registerAbort(controller);
    if (!reconnect) {
      setLastMessage(prompt);
      setPendingUserMessage({
        id: `pending-${crypto.randomUUID()}`,
        role: "user",
        status: "completed",
        content: prompt,
        startedAt: Date.now(),
        finishedAt: Date.now(),
        steps: [],
        tools: [],
        sources: [],
      });
      dispatch({ type: "reset" });
    }
    try {
      await clioApi.streamTurn(
        organizationId,
        selectedId,
        {
          message: prompt,
          clientMessageId: reconnect
            ? `reconnect-${recoveryRunId}`
            : crypto.randomUUID(),
          afterCursor: reconnect ? recoveryCursor : -1,
          reconnectRunId: reconnect ? recoveryRunId ?? undefined : undefined,
          retryOf,
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
      setPendingUserMessage(null);
    } catch (error) {
      if (!controller.signal.aborted) {
        dispatch({
          type: "transport-error",
          message: error instanceof Error ? error.message : "Stream disconnected",
        });
      }
    } finally {
      if (activeStreamController.current === controller) {
        activeStreamController.current = null;
      }
      unregister();
    }
  };

  const cancel = async () => {
    if (!stream.runId) return;
    activeStreamController.current?.abort("user-cancelled");
    try {
      const result = await clioApi.cancelRun(organizationId, stream.runId);
      await scopedQueryClient.invalidateQueries({
        queryKey: organizationKey(organizationId, "conversation", selectedId),
      });
      setPendingUserMessage(null);
      if (result.status === "cancelled") {
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
      } else {
        dispatch({ type: "reset" });
      }
    } catch (error) {
      dispatch({
        type: "transport-error",
        message: error instanceof Error ? error.message : "Cancellation failed",
      });
    }
  };

  const sessions = useMemo<ChatSession[]>(() => {
    const activeMessages: ChatMessage[] = (detail.data?.messages ?? []).map((message) => ({
      id: message.id,
      role: message.role,
      status: "completed",
      content: message.content,
      startedAt: Date.parse(message.created_at),
      finishedAt: Date.parse(message.created_at),
      steps: [],
      tools: [],
      sources: [],
    }));

    if (
      pendingUserMessage &&
      !activeMessages.some(
        (message) =>
          message.role === "user" && message.content === pendingUserMessage.content,
      )
    ) {
      activeMessages.push(pendingUserMessage);
    }

    if (
      selectedId &&
      (stream.status === "streaming" ||
        stream.status === "disconnected" ||
        stream.status === "failed")
    ) {
      activeMessages.push({
        id: `stream-${stream.runId ?? selectedId}`,
        role: "assistant",
        status: stream.status === "streaming" ? "running" : "failed",
        content: stream.text,
        startedAt: pendingUserMessage?.startedAt ?? Date.now(),
        finishedAt: null,
        steps: stream.status === "streaming" ? [{ title: "Shaping the outcome" }] : [],
        tools: [],
        sources: [],
        error: stream.status === "streaming" ? null : stream.error,
      });
    }

    return (conversations.data ?? []).map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      status: "active",
      pinned: false,
      archivedAt: null,
      updatedAt: Date.parse(conversation.updated_at),
      messages: conversation.id === selectedId ? activeMessages : [],
    }));
  }, [conversations.data, detail.data?.messages, pendingUserMessage, selectedId, stream.error, stream.runId, stream.status, stream.text]);

  const emptyPresentationSession: ChatSession = {
    id: selectedId ?? "new-chat",
    title: "New Chat",
    status: "active" as const,
    pinned: false,
    archivedAt: null,
    updatedAt: Date.now(),
    messages: [],
  };
  const activeSession = visualFixture
    ? visualFixture.session
    : sessions.find((session) => session.id === selectedId) ?? emptyPresentationSession;
  const presentationSessions = visualFixture ? visualFixture.sessions : sessions;
  const persistedRecoveryStatus =
    stream.status === "idle" && latestPersistedRun?.status === "running"
      ? "disconnected"
      : stream.status === "idle" && latestPersistedRun?.status === "cancelled"
        ? "cancelled"
        : stream.status === "idle" && latestPersistedRun?.status === "failed"
          ? "failed"
          : null;
  const presentationStreamStatus =
    visualFixture?.streamStatus ?? persistedRecoveryStatus ?? stream.status;
  const presentationStreamError =
    visualFixture?.streamError ??
    stream.error ??
    (persistedRecoveryStatus === "disconnected"
      ? "A saved run is ready to reconnect."
      : persistedRecoveryStatus === "failed"
        ? "The saved turn failed before completion."
        : null);
  const isStreaming = presentationStreamStatus === "streaming";
  const streamingSessionIds = new Set<string>(
    isStreaming ? [activeSession.id] : [],
  );
  const packet = visualFixture?.packet ?? detail.data?.packet ?? null;

  return (
    <div className={`app-shell${packetOpen ? " run-detail-open" : ""}`}>
      <Sidebar
        activeView={activeView}
        activeSessionId={activeSession.id}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        sessions={presentationSessions}
        streamingSessionIds={streamingSessionIds}
        organizationId={organizationId}
        organizationName={organizationName}
        organizations={fixtureOrganizations}
        sessionActionsEnabled={false}
        onSwitchOrganization={switchOrganization}
        onArchiveSession={() => undefined}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onDeleteSession={() => undefined}
        onNewChat={() => createConversation.mutate()}
        onRenameSession={() => undefined}
        onSelectSession={selectConversation}
        onSelectView={(view) => {
          setActiveView(view);
          setMobileSidebarOpen(false);
        }}
        onTogglePinnedSession={() => undefined}
        onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
      />

      <section className="app-main">
        <header className="app-header">
          <div className="header-leading">
            <button
              type="button"
              className="icon-button mobile-menu-button"
              aria-label="Open sidebar"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu size={19} />
            </button>
            {activeView === "chat" && activeSession.messages.length > 0 ? (
              <span className="header-title">{activeSession.title}</span>
            ) : null}
          </div>
          <button
            type="button"
            className="icon-button app-theme-control"
            aria-label={`Use ${theme === "dark" ? "light" : "dark"} theme`}
            onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {conversations.isError ? (
          <div className="clio-status-banner" role="alert">
            Conversations could not be loaded.
            <button type="button" onClick={() => void conversations.refetch()}>Retry</button>
          </div>
        ) : null}
        {detail.isError ? (
          <div className="clio-status-banner" role="alert">
            Saved history is unavailable.
            <button type="button" onClick={() => void detail.refetch()}>Retry</button>
          </div>
        ) : null}
        {visualFixture?.loading || (!visualFixture && selectedId && detail.isLoading) ? (
          <div className="clio-status-banner" role="status">
            Reopening saved history…
          </div>
        ) : null}
        {presentationStreamStatus === "disconnected" ? (
          <div className="clio-status-banner" role="alert">
            {presentationStreamError ?? "Stream disconnected"}
            <button type="button" onClick={() => void send(persistedPrompt, true)}>Reconnect</button>
          </div>
        ) : null}
        {presentationStreamStatus === "cancelled" ? (
          <div className="clio-status-banner">
            Turn canceled.
            <button type="button" onClick={() => void send(lastMessage || persistedPrompt, false, recoveryRunId ?? undefined)}>Retry turn</button>
          </div>
        ) : null}
        {presentationStreamStatus === "failed" ? (
          <div className="clio-status-banner" role="alert">
            {presentationStreamError ?? "The turn failed before completion."}
            <button type="button" onClick={() => void send(lastMessage || persistedPrompt, false, recoveryRunId ?? undefined)}>Retry turn</button>
          </div>
        ) : null}

        {activeView === "chat" ? (
          <ChatView
            session={activeSession}
            isStreaming={isStreaming}
            skills={planningSkills}
            onOpenConnectors={() => setActiveView("plugins")}
            onOpenContext={() => setPacketOpen(true)}
            onOpenSkills={() => setActiveView("plugins")}
            onSend={(prompt) => void send(prompt)}
            onStop={() => void cancel()}
          />
        ) : (
          <section className="library-view">
            <div className="library-inner">
              <header className="library-header">
                <h1>{activeView === "knowledge" ? "Knowledge Base" : "Plugins"}</h1>
                <p>
                  {activeView === "knowledge"
                    ? "Connect planning context to future Clio conversations."
                    : "Clio integrations arrive after the M1 evaluation boundary."}
                </p>
              </header>
            </div>
          </section>
        )}
      </section>

      {packetOpen ? (
        <aside className="detail-drawer run-detail-drawer" aria-label="Build Packet">
          <header className="detail-drawer-header run-detail-header">
            <div>
              <span>Versioned fixture artifact</span>
              <h2>Build Packet</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Close Build Packet"
              onClick={() => setPacketOpen(false)}
            >
              <X size={18} />
            </button>
          </header>
          <div className="detail-drawer-content clio-packet-content">
            {packet ? (
              <>
                <p className="clio-packet-version">Version {packet.version} · saved</p>
                {Object.entries(packet.content).map(([key, value]) => (
                  <section className="clio-packet-section" key={key}>
                    <h3>{key.replaceAll("_", " ")}</h3>
                    <p>{String(value)}</p>
                  </section>
                ))}
              </>
            ) : (
              <div className="clio-packet-empty">
                <h3>No packet snapshot yet</h3>
                <p>M1 uses a versioned fixture to prove the artifact boundary.</p>
              </div>
            )}
            <button
              className="primary-button clio-packet-action"
              type="button"
              disabled={!selectedId || updatePacket.isPending}
              onClick={() => updatePacket.mutate()}
            >
              {packet ? "Create next fixture version" : "Create fixture packet"}
            </button>
            {updatePacket.isError ? (
              <p className="clio-packet-error" role="alert">
                Version conflict or save failure. Reload before retrying.
              </p>
            ) : null}
            <div className="clio-packet-boundary">
              <strong>Evaluation boundary</strong>
              <p>Planning quality is not claimed in M1. STE-37 adds executable evidence.</p>
            </div>
          </div>
        </aside>
      ) : null}
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
