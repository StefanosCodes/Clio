import {
  Archive,
  Blocks,
  BookOpen,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Pin,
  PinOff,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import type { ChatSession } from "./types";

export type AppView = "chat" | "knowledge" | "plugins";

type SidebarProps = {
  activeView: AppView;
  activeSessionId: string;
  collapsed: boolean;
  mobileOpen: boolean;
  sessions: ChatSession[];
  streamingSessionIds: Set<string>;
  organizationId: string;
  organizationName: string;
  organizations: ReadonlyArray<{ id: string; name: string }>;
  sessionActionsEnabled?: boolean;
  onSwitchOrganization: (organizationId: string) => void | Promise<void>;
  onArchiveSession: (sessionId: string) => void | Promise<void>;
  onCloseMobile: () => void;
  onDeleteSession: (sessionId: string) => void | Promise<void>;
  onNewChat: () => void;
  onRenameSession: (
    sessionId: string,
    title: string,
  ) => void | Promise<void>;
  onSelectSession: (sessionId: string) => void;
  onSelectView: (view: AppView) => void;
  onTogglePinnedSession: (
    sessionId: string,
    pinned: boolean,
  ) => void | Promise<void>;
  onToggleCollapsed: () => void;
};

const navigation = [
  { id: "knowledge" as const, label: "Knowledge Base", icon: BookOpen },
  { id: "plugins" as const, label: "Plugins", icon: Blocks },
];

function SidebarButton({
  active,
  collapsed,
  icon: Icon,
  label,
  onClick,
}: {
  active?: boolean;
  collapsed: boolean;
  icon: typeof BookOpen;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`sidebar-button${active ? " is-active" : ""}`}
      onClick={onClick}
      aria-label={label}
      title={collapsed ? label : undefined}
    >
      <Icon size={17} strokeWidth={1.8} />
      {!collapsed ? <span>{label}</span> : null}
    </button>
  );
}

export function Sidebar({
  activeView,
  activeSessionId,
  collapsed,
  mobileOpen,
  sessions,
  streamingSessionIds,
  organizationId,
  organizationName,
  organizations,
  sessionActionsEnabled = true,
  onSwitchOrganization,
  onArchiveSession,
  onCloseMobile,
  onDeleteSession,
  onNewChat,
  onRenameSession,
  onSelectSession,
  onSelectView,
  onTogglePinnedSession,
  onToggleCollapsed,
}: SidebarProps) {
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(
    null,
  );
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ChatSession | null>(null);
  const activeSession = sessions.find(
    (session) => session.id === activeSessionId,
  );
  const isNewChatActive =
    activeView === "chat" && (activeSession?.messages.length ?? 0) === 0;
  const visibleSessions = sessions
    .filter(
      (session) =>
        session.status === "active" &&
        (session.id !== activeSessionId || session.messages.length > 0),
    )
    .toSorted(
      (left, right) =>
        Number(right.pinned) - Number(left.pinned) ||
        right.updatedAt - left.updatedAt,
    );

  const beginRename = (session: ChatSession) => {
    setRenameDraft(session.title);
    setRenamingSessionId(session.id);
    setMenuSessionId(null);
  };

  const submitRename = (sessionId: string) => {
    const title = renameDraft.trim();
    if (title) {
      void onRenameSession(sessionId, title);
    }
    setRenamingSessionId(null);
  };

  useEffect(() => {
    if (!deleteTarget) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDeleteTarget(null);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [deleteTarget]);

  return (
    <>
      {mobileOpen ? (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Dismiss sidebar"
          onClick={onCloseMobile}
        />
      ) : null}
      <aside
        className={[
          "sidebar",
          collapsed ? "is-collapsed" : "",
          mobileOpen ? "is-mobile-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="sidebar-header">
          {!collapsed ? <strong className="brand-name">Clio</strong> : null}
          <button
            type="button"
            className="icon-button sidebar-mobile-close"
            aria-label="Close sidebar"
            onClick={onCloseMobile}
          >
            <X size={18} />
          </button>
          <button
            type="button"
            className="icon-button sidebar-collapse"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={onToggleCollapsed}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
        </div>

        <nav className="sidebar-primary" aria-label="Primary">
          <SidebarButton
            active={isNewChatActive}
            collapsed={collapsed}
            icon={SquarePen}
            label="New Chat"
            onClick={onNewChat}
          />
          {navigation.map((item) => (
            <SidebarButton
              key={item.id}
              active={activeView === item.id}
              collapsed={collapsed}
              icon={item.icon}
              label={item.label}
              onClick={() => onSelectView(item.id)}
            />
          ))}
        </nav>

        {!collapsed ? (
          <section className="recent-section" aria-labelledby="recent-chats">
            <h2 id="recent-chats">Recents</h2>
            <div className="recent-list">
              {visibleSessions.map((session) => (
                <div
                  className={`recent-chat-row${
                    activeView === "chat" &&
                    activeSessionId === session.id
                      ? " is-active"
                      : ""
                  }${
                    renamingSessionId === session.id ? " is-renaming" : ""
                  }`}
                  key={session.id}
                >
                  {renamingSessionId === session.id ? (
                    <form
                      className="recent-rename"
                      onSubmit={(event) => {
                        event.preventDefault();
                        submitRename(session.id);
                      }}
                    >
                      <input
                        aria-label="Rename chat"
                        autoFocus
                        value={renameDraft}
                        onBlur={() => submitRename(session.id)}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onFocus={(event) => event.currentTarget.select()}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setRenamingSessionId(null);
                          }
                        }}
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="recent-chat"
                      onClick={() => onSelectSession(session.id)}
                    >
                      <span>{session.title}</span>
                      {session.pinned ? (
                        <Pin
                          className="recent-pin"
                          aria-label="Pinned"
                          size={12}
                        />
                      ) : null}
                      {streamingSessionIds.has(session.id) ? (
                        <span
                          className="stream-indicator"
                          aria-label="Response streaming"
                        />
                      ) : null}
                    </button>
                  )}
                  {sessionActionsEnabled && renamingSessionId !== session.id ? (
                    <button
                      type="button"
                      className="recent-menu-trigger"
                      aria-label={`Chat options for ${session.title}`}
                      aria-expanded={menuSessionId === session.id}
                      onClick={() =>
                        setMenuSessionId((current) =>
                          current === session.id ? null : session.id,
                        )
                      }
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  ) : null}
                  {menuSessionId === session.id ? (
                    <div
                      className="recent-menu"
                      role="menu"
                      aria-label={`Options for ${session.title}`}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => beginRename(session)}
                      >
                        <Pencil size={15} />
                        Rename
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          void onTogglePinnedSession(
                            session.id,
                            !session.pinned,
                          );
                          setMenuSessionId(null);
                        }}
                      >
                        {session.pinned ? (
                          <PinOff size={15} />
                        ) : (
                          <Pin size={15} />
                        )}
                        {session.pinned ? "Unpin" : "Pin"}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          void onArchiveSession(session.id);
                          setMenuSessionId(null);
                        }}
                      >
                        <Archive size={15} />
                        Archive
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="is-destructive"
                        onClick={() => {
                          setDeleteTarget(session);
                          setMenuSessionId(null);
                        }}
                      >
                        <Trash2 size={15} />
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="sidebar-account">
          <div className="account-avatar" aria-hidden="true">
            {organizationName.slice(0, 1).toUpperCase()}
          </div>
          {!collapsed ? (
            <label className="account-copy organization-account">
              <span className="sr-only">Fixture organization</span>
              <select
                aria-label="Fixture organization"
                value={organizationId}
                onChange={(event) => void onSwitchOrganization(event.target.value)}
              >
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
              <span>Fixture organization · M1</span>
            </label>
          ) : null}
        </footer>
      </aside>
      {deleteTarget ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDeleteTarget(null);
            }
          }}
        >
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-chat-title"
            aria-describedby="delete-chat-description"
          >
            <h2 id="delete-chat-title">Delete chat?</h2>
            <p id="delete-chat-description">
              “{deleteTarget.title}” and its messages will be permanently
              deleted.
            </p>
            <footer className="source-dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() => {
                  void onDeleteSession(deleteTarget.id);
                  setDeleteTarget(null);
                }}
              >
                Delete
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
