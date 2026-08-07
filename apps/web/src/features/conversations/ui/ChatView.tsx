import { CircleAlert } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AgentActivity, type ActivityDetail } from "./AgentActivity";
import { BuildPacketCard, BuildPacketStarter } from "./BuildPacket";
import { PromptComposer } from "./PromptComposer";
import type { BuildPacket, ChatSession } from "./types";

type ChatViewProps = {
  session: ChatSession;
  focusPacketCard?: boolean;
  isStreaming: boolean;
  packetCreationError: boolean;
  packetCreationPending: boolean;
  showPacketStarter?: boolean;
  openActivityMessageId: string | null;
  packet: BuildPacket | null;
  onCreatePacket: () => void;
  onOpenActivity: (detail: ActivityDetail) => void;
  onOpenPacket: () => void;
  onSend: (prompt: string) => void;
  onStop: () => void;
};

function AgentMessage({
  activityOpen,
  message,
  onOpenActivity,
}: {
  activityOpen: boolean;
  message: ChatSession["messages"][number];
  onOpenActivity: (detail: ActivityDetail) => void;
}) {
  return (
    <article className="message assistant-message">
      <div className="message-body">
        <AgentActivity
          finishedAt={message.finishedAt}
          isOpen={activityOpen}
          messageId={message.id}
          onOpenActivity={onOpenActivity}
          sources={message.sources}
          startedAt={message.startedAt}
          status={message.status}
          steps={message.steps}
          tools={message.tools}
        >
          {message.content ? (
            <div className="assistant-copy">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ children, ...props }) => (
                    <a
                      {...props}
                      className="inline-citation-pill"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : message.status === "queued" || message.status === "running" ? (
            <div className="thinking-bar" aria-label="Clio is thinking">
              <span>Thinking</span>
            </div>
          ) : null}
          {message.error ? (
            <div className="message-error" role="alert">
              <CircleAlert size={15} />
              <span>{message.error}</span>
            </div>
          ) : null}
        </AgentActivity>
      </div>
    </article>
  );
}

export function ChatView({
  focusPacketCard = false,
  session,
  isStreaming,
  packetCreationError,
  packetCreationPending,
  showPacketStarter = true,
  packet,
  openActivityMessageId,
  onCreatePacket,
  onOpenActivity,
  onOpenPacket,
  onSend,
  onStop,
}: ChatViewProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasMessages = session.messages.length > 0;
  const streamContent =
    session.messages.at(-1)?.content ?? session.messages.length.toString();

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: isStreaming ? "auto" : "smooth",
    });
  }, [isStreaming, session.messages.length, streamContent]);

  useEffect(() => {
    setDraft("");
    textareaRef.current?.focus();
  }, [session.id]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = hasMessages ? "22px" : "44px";
    }
  }, [hasMessages]);

  const submit = () => {
    const prompt = draft.trim();
    if (!prompt || isStreaming) {
      return;
    }
    setDraft("");
    onSend(prompt);
    if (textareaRef.current) {
      textareaRef.current.style.height = "22px";
    }
  };

  const composer = (
    <div className="composer-region">
      <PromptComposer
        ref={textareaRef}
        compact={hasMessages}
        isStreaming={isStreaming}
        value={draft}
        onStop={onStop}
        onSubmit={submit}
        onValueChange={setDraft}
      />

    </div>
  );

  return (
    <main className={`chat-view${hasMessages ? " has-messages" : ""}`}>
      {hasMessages ? (
        <>
          <div className="transcript" ref={scrollRef}>
            <div className="message-list">
              {session.messages.map((message) =>
                message.role === "user" ? (
                  <article className="message user-message" key={message.id}>
                    <div className="user-bubble">{message.content}</div>
                  </article>
                ) : (
                  <AgentMessage
                    activityOpen={openActivityMessageId === message.id}
                    key={message.id}
                    message={message}
                    onOpenActivity={onOpenActivity}
                  />
                ),
              )}
              {packet ? (
                <BuildPacketCard
                  focusOnMount={focusPacketCard}
                  packet={packet}
                  onOpen={onOpenPacket}
                />
              ) : showPacketStarter && !isStreaming ? (
                <BuildPacketStarter
                  disabled={packetCreationPending}
                  error={packetCreationError}
                  onCreate={onCreatePacket}
                />
              ) : null}
            </div>
          </div>
          {composer}
        </>
      ) : (
        <section className="empty-chat">
          <h1>Turn an idea into planned work</h1>
          <p className="empty-chat-subtitle">
            Describe the outcome, problem, or change. Clio will shape the scope and evidence.
          </p>
          {composer}
        </section>
      )}
    </main>
  );
}
