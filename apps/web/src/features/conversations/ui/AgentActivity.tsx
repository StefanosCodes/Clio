import {
  BookOpen,
  Check,
  ChevronRight,
  Database,
  ExternalLink,
  Globe2,
  LoaderCircle,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import type {
  ActivityStep,
  ChatMessage,
  ChatSource,
  ToolActivity,
} from "./types";

function readableName(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase(),
  );
}

function sourceDomain(source: ChatSource): string {
  if (!source.url) {
    return source.provider;
  }
  try {
    return new URL(source.url).hostname.replace(/^www\./, "");
  } catch {
    return source.provider;
  }
}

function elapsedSeconds(
  startedAt: number | null,
  finishedAt: number | null,
): number | null {
  if (startedAt === null) {
    return null;
  }
  return Math.max(1, Math.round(((finishedAt ?? Date.now()) - startedAt) / 1000));
}

function isInternalStep(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  return (
    normalized === "working" ||
    normalized.includes("openai agents sdk loop") ||
    normalized === "running the agent loop"
  );
}

function publicActivity(
  steps: ActivityStep[],
  tools: ToolActivity[],
  sources: ChatSource[],
): string[] {
  const labels = steps
    .map((step) => step.title.trim())
    .filter((title) => title && !isInternalStep(title));

  for (const tool of tools) {
    const name = readableName(tool.name);
    const label =
      tool.status === "running"
        ? `Using ${name}`
        : tool.status === "failed"
          ? `${name} failed`
          : tool.summary || `Used ${name}`;
    if (!labels.includes(label)) {
      labels.push(label);
    }
  }

  if (sources.length > 0) {
    labels.push(
      `Reviewed ${sources.length} ${sources.length === 1 ? "source" : "sources"}`,
    );
  }

  return labels;
}

function RunDetailDrawer({
  duration,
  onClose,
  publicSteps,
  running,
  sources,
  tools,
}: {
  duration: number | null;
  onClose: () => void;
  publicSteps: string[];
  running: boolean;
  sources: ChatSource[];
  tools: ToolActivity[];
}) {
  const title = duration === null ? "Activity" : `Activity · ${duration}s`;
  const webSearchRunning = tools.some(
    (tool) => tool.name === "web_search" && tool.status === "running",
  );
  const knowledgeSearchRunning = tools.some(
    (tool) =>
      tool.name === "search_knowledge_base" && tool.status === "running",
  );
  const hasWebSources = sources.some((source) => source.kind === "web");
  const hasKnowledgeSources = sources.some(
    (source) => source.kind === "knowledge",
  );
  const activeLabel = webSearchRunning
    ? "Searching the web"
    : knowledgeSearchRunning
      ? "Searching knowledge"
      : hasWebSources
        ? "Searched the web"
        : hasKnowledgeSources
          ? "Searched knowledge"
          : running
            ? "Thinking"
            : publicSteps.at(-1) ?? "Finished";
  const domains = Array.from(new Set(sources.map(sourceDomain)));

  useEffect(() => {
    document.documentElement.classList.add("run-detail-open");
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.documentElement.classList.remove("run-detail-open");
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return createPortal(
    <aside
      className="detail-drawer run-detail-drawer"
      role="dialog"
      aria-modal="false"
      aria-labelledby="run-detail-title"
    >
        <header className="detail-drawer-header run-detail-header">
          <h2 id="run-detail-title">{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Close activity"
            title="Close"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="detail-drawer-content">
          <section className="run-detail-section">
            <h3>Thinking</h3>
            <div className="activity-timeline">
              <div className="activity-timeline-item">
                <span className="activity-timeline-icon">
                  {webSearchRunning || sources.some((source) => source.kind === "web") ? (
                    <Globe2 size={15} />
                  ) : knowledgeSearchRunning ||
                    sources.some((source) => source.kind === "knowledge") ? (
                    <Database size={15} />
                  ) : (
                    <Search size={15} />
                  )}
                </span>
                <div>
                  <strong>{activeLabel}</strong>
                  {domains.length > 0 ? (
                    <div className="activity-domain-list">
                      {domains.slice(0, 4).map((domain) => (
                        <span key={domain}>{domain}</span>
                      ))}
                      {domains.length > 4 ? (
                        <span>+{domains.length - 4} more</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="activity-timeline-item is-finished">
                <span className="activity-timeline-icon">
                  {running ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <Check size={15} />
                  )}
                </span>
                <div>
                  <strong>
                    {running
                      ? "Working"
                      : duration === null
                        ? "Finished"
                        : `Worked for ${duration}s`}
                  </strong>
                  <span>{running ? "In progress" : "Done"}</span>
                </div>
              </div>
            </div>
          </section>

          {sources.length > 0 ? (
            <section className="run-detail-section">
              <h3>Sources · {sources.length}</h3>
              <div className="source-detail-list">
                {sources.map((source) => {
                  const content = (
                    <>
                      <span className="source-detail-icon">
                        {source.kind === "web" ? (
                          <Globe2 size={16} />
                        ) : (
                          <BookOpen size={16} />
                        )}
                      </span>
                      <span className="source-detail-copy">
                        <small>{sourceDomain(source)}</small>
                        <strong>{source.title}</strong>
                        {source.description ? <p>{source.description}</p> : null}
                      </span>
                      {source.url ? <ExternalLink size={15} /> : null}
                    </>
                  );
                  return source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      key={source.id}
                    >
                      {content}
                    </a>
                  ) : (
                    <div className="source-detail-item" key={source.id}>
                      {content}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

        </div>
    </aside>,
    document.body,
  );
}

export function AgentActivity({
  children,
  finishedAt,
  sources,
  startedAt,
  status,
  steps,
  tools,
}: {
  children: ReactNode;
  finishedAt: number | null;
  sources: ChatSource[];
  startedAt: number | null;
  status: ChatMessage["status"];
  steps: ActivityStep[];
  tools: ToolActivity[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hasDetails = tools.length > 0 || sources.length > 0;
  const duration = elapsedSeconds(startedAt, finishedAt);
  const activity = useMemo(
    () => publicActivity(steps, tools, sources),
    [sources, steps, tools],
  );
  const running = status === "queued" || status === "running";
  const runningTool = tools.find((tool) => tool.status === "running");
  const label = running
    ? runningTool?.name === "web_search"
      ? "Searching the web"
      : runningTool?.name === "search_knowledge_base"
        ? "Searching knowledge"
        : "Thinking"
    : duration === null
      ? "Activity"
      : `Worked for ${duration}s`;
  const showActivity = running || hasDetails;

  return (
    <>
      {showActivity ? (
        <div className="agent-activity">
          <button
            type="button"
            className="agent-activity-trigger"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <span>
              {running ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Settings2 size={15} />
              )}
              {label}
            </span>
            <ChevronRight
              size={15}
            />
          </button>
        </div>
      ) : null}

      {children}

      {hasDetails ? (
        <div className="response-actions">
          <button type="button" onClick={() => setDrawerOpen(true)}>
            {sources.length > 0 ? (
              <BookOpen size={14} />
            ) : (
              <Settings2 size={14} />
            )}
            {sources.length > 0 ? "Sources" : "Details"}
          </button>
        </div>
      ) : null}

      {drawerOpen ? (
        <RunDetailDrawer
          duration={duration}
          publicSteps={activity}
          running={running}
          sources={sources}
          tools={tools}
          onClose={() => setDrawerOpen(false)}
        />
      ) : null}
    </>
  );
}
