import { CircleAlert } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { SkillCatalogItem } from "./catalog";
import { AgentActivity } from "./AgentActivity";
import { PromptComposer } from "./PromptComposer";
import type { ChatSession } from "./types";

type ChatViewProps = {
  session: ChatSession;
  isStreaming: boolean;
  skills: SkillCatalogItem[];
  onOpenConnectors: () => void;
  onOpenContext: () => void;
  onOpenSkills: () => void;
  onSend: (prompt: string, skillIds: string[]) => void;
  onStop: () => void;
};

function AgentMessage({
  message,
}: {
  message: ChatSession["messages"][number];
}) {
  return (
    <article className="message assistant-message">
      <div className="message-body">
        <AgentActivity
          finishedAt={message.finishedAt}
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
  session,
  isStreaming,
  skills,
  onOpenConnectors,
  onOpenContext,
  onOpenSkills,
  onSend,
  onStop,
}: ChatViewProps) {
  const [draft, setDraft] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<SkillCatalogItem | null>(
    null,
  );
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
    setSelectedSkill(null);
    textareaRef.current?.focus();
  }, [session.id]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = hasMessages ? "24px" : "48px";
    }
  }, [hasMessages]);

  const submit = () => {
    const prompt = draft.trim();
    if (!prompt || isStreaming) {
      return;
    }
    setDraft("");
    onSend(prompt, selectedSkill ? [selectedSkill.id] : []);
    setSelectedSkill(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "24px";
    }
  };

  const composer = (
    <div className="composer-region">
      <PromptComposer
        ref={textareaRef}
        compact={hasMessages}
        isStreaming={isStreaming}
        skills={skills}
        selectedSkill={selectedSkill}
        value={draft}
        onOpenConnectors={onOpenConnectors}
        onOpenContext={onOpenContext}
        onOpenSkills={onOpenSkills}
        onStop={onStop}
        onSubmit={submit}
        onRemoveSkill={() => setSelectedSkill(null)}
        onSelectSkill={setSelectedSkill}
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
                  <AgentMessage key={message.id} message={message} />
                ),
              )}
            </div>
          </div>
          {composer}
        </>
      ) : (
        <section className="empty-chat">
          <h1>What&apos;s on the agenda today?</h1>
          {composer}
        </section>
      )}
    </main>
  );
}
