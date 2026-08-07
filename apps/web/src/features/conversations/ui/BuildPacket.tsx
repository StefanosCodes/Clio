import { ArrowLeft, ArrowRight, FileText, Maximize2, X } from "lucide-react";
import {
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { BuildPacket as BuildPacketRecord } from "./types";

const HIDDEN_PACKET_FIELDS = new Set(["source_conversation"]);

function fieldLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase(),
  );
}

function packetSummary(packet: BuildPacketRecord) {
  const outcome = packet.content.outcome;
  return typeof outcome === "string" && outcome.trim()
    ? outcome
    : "A saved planning artifact from this conversation.";
}

function packetState(packet: BuildPacketRecord) {
  return `Saved · Version ${packet.version}`;
}

function stringifyPacketValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (Array.isArray(value) || typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function canonicalPacketMarkdown(content: Record<string, unknown>) {
  for (const key of ["markdown", "body_markdown"]) {
    const value = content[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function packetSectionSummary(packet: BuildPacketRecord) {
  const canonicalMarkdown = canonicalPacketMarkdown(packet.content);
  const count = canonicalMarkdown
    ? (canonicalMarkdown.match(/^##\s+.+$/gm) ?? []).length
    : Object.entries(packet.content).filter(
        ([key, value]) =>
          !HIDDEN_PACKET_FIELDS.has(key) &&
          !["title", "outcome", "audience", "status", "markdown", "body_markdown"].includes(
            key,
          ) &&
          stringifyPacketValue(value).trim(),
      ).length;

  return count > 0
    ? `${count} section${count === 1 ? "" : "s"}`
    : "Saved artifact";
}

function parseEditableValue(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function savableContent(content: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(content).map(([key, value]) => [key, parseEditableValue(value)]),
  );
}

function editableContent(
  packet: BuildPacketRecord | null,
  defaultContent: Record<string, unknown>,
) {
  return Object.fromEntries(
    Object.entries({ ...defaultContent, ...packet?.content })
      .filter(([key]) => !HIDDEN_PACKET_FIELDS.has(key))
      .map(([key, value]) => [key, stringifyPacketValue(value)]),
  );
}

function parseDiagramEdges(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)\s*->\s*(.+?)(?::\s*(.+))?$/);
      if (!match) return null;
      return {
        from: match[1].trim(),
        to: match[2].trim(),
        label: match[3]?.trim() ?? "",
      };
    })
    .filter((edge): edge is { from: string; to: string; label: string } =>
      Boolean(edge),
    );
}

function parseJsonValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function typedString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseStructuredArray(value: string) {
  const parsed = parseJsonValue(value);
  return Array.isArray(parsed) ? parsed : null;
}

function parseDecisionFlow(value: string) {
  const structured = parseStructuredArray(value);
  if (structured) {
    const edges = structured
      .filter(isRecord)
      .map((item) => ({
        from: typedString(item.from),
        to: typedString(item.to),
        label: typedString(item.label),
      }))
      .filter((edge) => edge.from && edge.to);
    if (edges.length > 0) return edges;
  }
  return parseDiagramEdges(value);
}

function PacketFlowDiagram({
  edges,
  label,
}: {
  edges: { from: string; to: string; label: string }[];
  label: string;
}) {
  const nodes = Array.from(
    new Set(edges.flatMap((edge) => [edge.from, edge.to])),
  );

  return (
    <figure
      className="packet-flow-diagram"
      role="img"
      aria-label={`${label} diagram`}
    >
      <div className="packet-flow-nodes">
        {nodes.map((node, index) => (
          <div className="packet-flow-step" key={node}>
            <span className="packet-flow-node">{node}</span>
            {index < nodes.length - 1 ? (
              <span className="packet-flow-connector" aria-hidden="true">
                {edges[index]?.label ? <small>{edges[index].label}</small> : null}
                <i />
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </figure>
  );
}

function markdownCell(value: unknown) {
  return stringifyPacketValue(value)
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ")
    .trim();
}

function mermaidLabel(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', "\\\"");
}

function decisionFlowMarkdown(value: unknown) {
  const edges = parseDecisionFlow(stringifyPacketValue(value));
  if (edges.length === 0) return stringifyPacketValue(value);

  const nodeIds = new Map<string, string>();
  const nodeId = (node: string) => {
    const existing = nodeIds.get(node);
    if (existing) return existing;
    const next = `N${nodeIds.size}`;
    nodeIds.set(node, next);
    return next;
  };

  const lines = edges.map((edge) => {
    const from = `${nodeId(edge.from)}["${mermaidLabel(edge.from)}"]`;
    const to = `${nodeId(edge.to)}["${mermaidLabel(edge.to)}"]`;
    const label = edge.label
      ? `|${edge.label.replaceAll("|", "/")}|`
      : "";
    return `  ${from} -->${label} ${to}`;
  });

  return ["```mermaid", "flowchart LR", ...lines, "```"].join("\n");
}

function markdownTable(value: unknown[]) {
  const records = value.filter(isRecord);
  if (records.length === 0) return "";
  const preferred = ["label", "summary", "owner", "status"];
  const available = Array.from(
    new Set(records.flatMap((record) => Object.keys(record))),
  );
  const columns = [
    ...preferred.filter((key) => available.includes(key)),
    ...available.filter((key) => !preferred.includes(key)),
  ];
  if (columns.length === 0) return "";

  return [
    `| ${columns.map(fieldLabel).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...records.map(
      (record) => `| ${columns.map((key) => markdownCell(record[key])).join(" | ")} |`,
    ),
  ].join("\n");
}

function markdownRecord(record: Record<string, unknown>) {
  return Object.entries(record)
    .filter(([, value]) => stringifyPacketValue(value).trim())
    .map(([key, value]) => `  - **${fieldLabel(key)}:** ${stringifyPacketValue(value)}`)
    .join("\n");
}

function packetValueMarkdown(key: string, value: unknown) {
  const normalizedKey = key.toLowerCase();
  if (normalizedKey.includes("flow") || normalizedKey.includes("diagram")) {
    return decisionFlowMarkdown(value);
  }
  if (Array.isArray(value)) {
    if (normalizedKey.includes("milestone")) {
      return markdownTable(value);
    }
    if (value.every((item) => typeof item === "string")) {
      const marker = normalizedKey.includes("question") ? "1." : "-";
      return value.map((item) => `${marker} ${item}`).join("\n");
    }
    return value
      .filter(isRecord)
      .map((record) => {
        const title = typedString(record.label) || typedString(record.name);
        const details = Object.fromEntries(
          Object.entries(record).filter(([field]) => field !== "label" && field !== "name"),
        );
        return `${title ? `- **${title}**` : "-"}\n${markdownRecord(details)}`;
      })
      .join("\n");
  }
  if (isRecord(value)) return markdownRecord(value);
  return stringifyPacketValue(value);
}

function packetMarkdown(content: Record<string, unknown>) {
  const canonicalMarkdown = canonicalPacketMarkdown(content);
  if (canonicalMarkdown) return canonicalMarkdown;

  const visibleEntries = Object.entries(content).filter(
    ([key, value]) => !HIDDEN_PACKET_FIELDS.has(key) && stringifyPacketValue(value).trim(),
  );
  const title = visibleEntries.find(([key]) => key === "title");
  const outcome = visibleEntries.find(([key]) => key === "outcome");
  const metadata = visibleEntries.filter(([key]) => key === "audience" || key === "status");
  const sections = visibleEntries.filter(
    ([key]) =>
      key !== "title" && key !== "outcome" && key !== "audience" && key !== "status",
  );
  const document = [
    `# ${title ? stringifyPacketValue(title[1]) : outcome ? stringifyPacketValue(outcome[1]) : "Build Packet"}`,
  ];

  if (metadata.length > 0) {
    document.push(
      metadata
        .map(([key, value]) => `**${fieldLabel(key)}:** ${stringifyPacketValue(value)}`)
        .join(" · "),
    );
  }

  if (title && outcome) {
    document.push(stringifyPacketValue(outcome[1]));
  }

  for (const [key, value] of sections) {
    document.push(`## ${fieldLabel(key)}`, packetValueMarkdown(key, value));
  }

  return document.join("\n\n");
}

function parseMermaidFlow(source: string) {
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^(flowchart|graph)\s/i.test(line));
  const edges = [];

  for (const line of lines) {
    const match = line.match(
      /^[A-Za-z0-9_]+\["(.+?)"\]\s*-->\s*(?:\|(.+?)\|\s*)?[A-Za-z0-9_]+\["(.+?)"\]$/,
    );
    if (!match) return null;
    edges.push({
      from: match[1].replaceAll('\\"', '"'),
      label: match[2]?.trim() ?? "",
      to: match[3].replaceAll('\\"', '"'),
    });
  }

  return edges;
}

function PacketMarkdownPre({ children }: { children?: ReactNode }) {
  if (
    isValidElement<{ className?: string; children?: ReactNode }>(children) &&
    children.props.className?.includes("language-mermaid")
  ) {
    const source = String(children.props.children ?? "").trim();
    const edges = parseMermaidFlow(source);
    if (edges && edges.length > 0) {
      return <PacketFlowDiagram edges={edges} label="Build Packet" />;
    }
  }

  return <pre>{children}</pre>;
}

function AutoGrowTextarea({
  "aria-label": ariaLabel,
  onChange,
  rows,
  value,
}: {
  "aria-label": string;
  onChange: (value: string) => void;
  rows: number;
  value: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      aria-label={ariaLabel}
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function PacketEditor({
  content,
  onChange,
}: {
  content: Record<string, string>;
  onChange: (content: Record<string, string>) => void;
}) {
  return (
    <div className="build-packet-editor">
      {Object.entries(content).map(([key, value]) => {
        const label = fieldLabel(key);
        return (
          <label key={key}>
            <span>{label}</span>
            <AutoGrowTextarea
              aria-label={label}
              rows={key === "outcome" || key.includes("diagram") ? 3 : 1}
              value={value}
              onChange={(nextValue) => onChange({ ...content, [key]: nextValue })}
            />
          </label>
        );
      })}
    </div>
  );
}

function PacketDocument({ content }: { content: Record<string, unknown> }) {
  return (
    <article className="build-packet-document">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          pre: PacketMarkdownPre,
        }}
      >
        {packetMarkdown(content)}
      </ReactMarkdown>
    </article>
  );
}

export function BuildPacketCard({
  focusOnMount = false,
  onOpen,
  packet,
}: {
  focusOnMount?: boolean;
  onOpen: () => void;
  packet: BuildPacketRecord;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusOnMount) buttonRef.current?.focus();
  }, [focusOnMount]);

  return (
    <article
      className="build-packet-card"
      aria-label={`Build Packet version ${packet.version}`}
    >
      <button ref={buttonRef} type="button" onClick={onOpen}>
        <span className="build-packet-card-icon" aria-hidden="true">
          <FileText size={19} strokeWidth={1.8} />
        </span>
        <span className="build-packet-card-copy">
          <span className="build-packet-card-heading">
            <strong>Build Packet</strong>
            <small>{packetState(packet)}</small>
          </span>
          <span className="build-packet-card-summary">
            {packetSummary(packet)}
          </span>
          <span className="build-packet-card-meta">
            {packetSectionSummary(packet)}
          </span>
        </span>
        <span className="build-packet-card-open">
          Open
          <ArrowRight size={16} />
        </span>
      </button>
    </article>
  );
}

export function BuildPacketStarter({
  disabled,
  error,
  onCreate,
}: {
  disabled: boolean;
  error: boolean;
  onCreate: () => void;
}) {
  return (
    <article className="build-packet-card build-packet-starter">
      <button type="button" disabled={disabled} onClick={onCreate}>
        <span className="build-packet-card-icon" aria-hidden="true">
          <FileText size={19} strokeWidth={1.8} />
        </span>
        <span className="build-packet-card-copy">
          <span className="build-packet-card-heading">
            <strong>Build Packet</strong>
            <small>Planning artifact</small>
          </span>
          <span className="build-packet-card-summary">
            Create a saved packet from this conversation.
          </span>
          {error ? (
            <span className="build-packet-card-error" role="alert">
              The packet could not be created. Try again.
            </span>
          ) : null}
        </span>
        <span className="build-packet-card-open">
          {disabled ? "Creating…" : "Create"}
          <ArrowRight size={16} />
        </span>
      </button>
    </article>
  );
}

export function BuildPacketWorkspace({
  canSave,
  defaultContent,
  error,
  onBack,
  onSave,
  packet,
  saving,
}: {
  canSave: boolean;
  defaultContent: Record<string, unknown>;
  error: boolean;
  onBack: () => void;
  onSave: (content: Record<string, unknown>) => void;
  packet: BuildPacketRecord | null;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    editableContent(packet, defaultContent),
  );

  useEffect(() => {
    setDraft(editableContent(packet, defaultContent));
  }, [packet?.version]);

  return (
    <main className="build-packet-workspace">
      <div className="build-packet-workspace-inner">
        <header className="build-packet-workspace-header">
          <button
            type="button"
            className="build-packet-back"
            onClick={onBack}
          >
            <ArrowLeft size={17} />
            Back to conversation
          </button>
          <div>
            <span>{packet ? packetState(packet) : "Not created"}</span>
            <h1>Build Packet</h1>
          </div>
        </header>

        {packet ? (
          <PacketDocument content={packet.content} />
        ) : (
          <>
            <section className="build-packet-workspace-empty">
              <span className="build-packet-empty-icon" aria-hidden="true">
                <FileText size={22} strokeWidth={1.7} />
              </span>
              <h2>No Build Packet yet</h2>
              <p>
                Create a saved snapshot of this conversation&apos;s outcome, audience,
                and current status.
              </p>
            </section>
            <PacketEditor content={draft} onChange={setDraft} />
          </>
        )}

        <footer className="build-packet-workspace-actions">
          {!packet ? (
            <button
              className="primary-button"
              type="button"
              disabled={!canSave || saving}
              onClick={() => onSave(savableContent(draft))}
            >
              {saving ? "Saving…" : "Create Build Packet"}
            </button>
          ) : null}
          <button className="secondary-button" type="button" onClick={onBack}>
            Continue in chat
          </button>
          {!packet && error ? (
            <p className="build-packet-workspace-error" role="alert">
              The Packet could not be saved. Return to chat, reload, and try again.
            </p>
          ) : null}
        </footer>
      </div>
    </main>
  );
}

export function BuildPacketPane({
  canSave,
  defaultContent,
  error,
  focusOnMount = false,
  onCloseMobile,
  onOpenFullView,
  onSave,
  packet,
  saving,
}: {
  canSave: boolean;
  defaultContent: Record<string, unknown>;
  error: boolean;
  focusOnMount?: boolean;
  onCloseMobile: () => void;
  onOpenFullView: () => void;
  onSave: (content: Record<string, unknown>) => void;
  packet: BuildPacketRecord | null;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    editableContent(packet, defaultContent),
  );
  const paneRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setDraft(editableContent(packet, defaultContent));
  }, [packet?.version]);

  useEffect(() => {
    if (focusOnMount) paneRef.current?.focus();
  }, [focusOnMount]);

  return (
    <section
      className="build-packet-pane"
      ref={paneRef}
      tabIndex={-1}
      aria-labelledby="build-packet-pane-title"
    >
      <header className="build-packet-pane-header">
        <div>
          <span>{packet ? packetState(packet) : "Not created"}</span>
          <h2 id="build-packet-pane-title">Build Packet</h2>
        </div>
        <div className="build-packet-pane-controls">
          <button
            type="button"
            className="icon-button"
            aria-label="Open Build Packet full view"
            title="Open full view"
            onClick={onOpenFullView}
          >
            <Maximize2 size={17} />
          </button>
          <button
            type="button"
            className="icon-button content-pane-mobile-close"
            aria-label="Close Build Packet"
            onClick={onCloseMobile}
          >
            <X size={18} />
          </button>
        </div>
      </header>
      <div className="build-packet-pane-content">
        {packet ? (
          <PacketDocument content={packet.content} />
        ) : (
          <>
            <p className="build-packet-pane-intro">
              Turn this conversation into a clear, saved plan.
            </p>
            <PacketEditor content={draft} onChange={setDraft} />
            <div className="build-packet-pane-actions">
              <button
                type="button"
                className="primary-button"
                disabled={!canSave || saving}
                onClick={() => onSave(savableContent(draft))}
              >
                {saving ? "Saving…" : "Create Build Packet"}
              </button>
              {error ? (
                <p className="build-packet-workspace-error" role="alert">
                  The Packet could not be saved. Reload and try again.
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function BuildPacketDrawer({
  canSave,
  defaultContent,
  error,
  onClose,
  onOpenFullView,
  onSave,
  packet,
  saving,
}: {
  canSave: boolean;
  defaultContent: Record<string, unknown>;
  error: boolean;
  onClose: () => void;
  onOpenFullView: () => void;
  onSave: (content: Record<string, unknown>) => void;
  packet: BuildPacketRecord | null;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    editableContent(packet, defaultContent),
  );

  useEffect(() => {
    setDraft(editableContent(packet, defaultContent));
  }, [packet?.version]);

  useEffect(() => {
    document.documentElement.classList.add("run-detail-open");
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.documentElement.classList.remove("run-detail-open");
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return createPortal(
    <aside
      className="detail-drawer run-detail-drawer build-packet-drawer"
      role="dialog"
      aria-modal="false"
      aria-labelledby="packet-drawer-title"
    >
      <header className="detail-drawer-header run-detail-header">
        <div>
          <span>{packet ? packetState(packet) : "Not created"}</span>
          <h2 id="packet-drawer-title">Build Packet</h2>
        </div>
        <div className="build-packet-drawer-controls">
          <button
            type="button"
            className="icon-button"
            aria-label="Open Build Packet full view"
            title="Open full view"
            onClick={onOpenFullView}
          >
            <Maximize2 size={17} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Close Build Packet"
            title="Close"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
      </header>
      <div className="detail-drawer-content build-packet-drawer-content">
        {packet ? (
          <PacketDocument content={packet.content} />
        ) : (
          <>
            <p className="build-packet-drawer-intro">
              Start the Packet here, then save it as a durable artifact.
            </p>
            <PacketEditor content={draft} onChange={setDraft} />
            <div className="build-packet-drawer-actions">
              <button
                type="button"
                className="primary-button"
                disabled={!canSave || saving}
                onClick={() => onSave(savableContent(draft))}
              >
                {saving ? "Saving…" : "Create Build Packet"}
              </button>
              {error ? (
                <p className="build-packet-workspace-error" role="alert">
                  The Packet could not be saved. Reload and try again.
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </aside>,
    document.body,
  );
}
