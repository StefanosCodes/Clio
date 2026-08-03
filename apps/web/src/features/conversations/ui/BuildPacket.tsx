import { ArrowLeft, ArrowRight, FileText, Maximize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { BuildPacket as BuildPacketRecord } from "./types";

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

function customerFieldCount(packet: BuildPacketRecord) {
  return Object.keys(packet.content).filter(
    (key) => key !== "source_conversation",
  ).length;
}

function editableContent(
  packet: BuildPacketRecord | null,
  defaultContent: Record<string, unknown>,
) {
  return Object.fromEntries(
    Object.entries({ ...defaultContent, ...packet?.content })
      .filter(([key]) => key !== "source_conversation")
      .map(([key, value]) => [key, String(value)]),
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
      {Object.entries(content).map(([key, value]) => (
        <label key={key}>
          <span>{fieldLabel(key)}</span>
          <textarea
            aria-label={fieldLabel(key)}
            rows={key === "outcome" ? 4 : 2}
            value={value}
            onChange={(event) =>
              onChange({ ...content, [key]: event.target.value })
            }
          />
        </label>
      ))}
    </div>
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
            <small>Draft · Version {packet.version}</small>
          </span>
          <span className="build-packet-card-summary">
            {packetSummary(packet)}
          </span>
          <span className="build-packet-card-meta">
            {customerFieldCount(packet)} sections · Saved
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
            <span>{packet ? `Draft · Version ${packet.version}` : "Draft"}</span>
            <h1>Build Packet</h1>
          </div>
        </header>

        {!packet ? (
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
        ) : null}

        <PacketEditor content={draft} onChange={setDraft} />

        <footer className="build-packet-workspace-actions">
          <button
            className="primary-button"
            type="button"
            disabled={!canSave || saving}
            onClick={() => onSave(draft)}
          >
            {saving
              ? "Saving…"
              : packet
                ? "Save new version"
                : "Create Build Packet"}
          </button>
          <button className="secondary-button" type="button" onClick={onBack}>
            Continue in chat
          </button>
          {error ? (
            <p className="build-packet-workspace-error" role="alert">
              The Packet could not be saved. Return to chat, reload, and try again.
            </p>
          ) : null}
        </footer>
      </div>
    </main>
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
          <span>{packet ? `Draft · Version ${packet.version}` : "Draft"}</span>
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
        {!packet ? (
          <p className="build-packet-drawer-intro">
            Start the Packet here, then save it as a durable version.
          </p>
        ) : null}
        <PacketEditor content={draft} onChange={setDraft} />
        <div className="build-packet-drawer-actions">
          <button
            type="button"
            className="primary-button"
            disabled={!canSave || saving}
            onClick={() => onSave(draft)}
          >
            {saving
              ? "Saving…"
              : packet
                ? "Save new version"
                : "Create Build Packet"}
          </button>
          {error ? (
            <p className="build-packet-workspace-error" role="alert">
              The Packet could not be saved. Reload and try again.
            </p>
          ) : null}
        </div>
      </div>
    </aside>,
    document.body,
  );
}
