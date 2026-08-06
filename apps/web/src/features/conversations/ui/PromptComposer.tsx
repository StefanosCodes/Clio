import {
  ArrowUp,
  Square,
} from "lucide-react";
import {
  forwardRef,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useState,
} from "react";

type PromptComposerProps = {
  compact?: boolean;
  isStreaming: boolean;
  value: string;
  onStop: () => void;
  onSubmit: () => void;
  onValueChange: (value: string) => void;
};

export const PromptComposer = forwardRef<
  HTMLTextAreaElement,
  PromptComposerProps
>(function PromptComposer(
  {
    compact = false,
    isStreaming,
    value,
    onStop,
    onSubmit,
    onValueChange,
  },
  textareaRef,
) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!value) {
      setExpanded(false);
    }
  }, [value]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!value.trim() || isStreaming) {
      return;
    }
    onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div
      className={[
        "prompt-composer",
        compact ? "is-compact" : "",
        compact && expanded ? "is-expanded" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <form className="composer" onSubmit={submit}>
        <textarea
          ref={textareaRef}
          aria-label="Message"
          placeholder={compact ? "Follow up" : "Describe what you want to build or change"}
          rows={1}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onInput={(event) => {
            const input = event.currentTarget;
            input.style.height = compact ? "22px" : "44px";
            const nextHeight = Math.min(input.scrollHeight, 144);
            input.style.height = `${nextHeight}px`;
            setExpanded(compact && nextHeight > 22);
          }}
          onKeyDown={handleKeyDown}
        />

        <div className="composer-toolbar">
          <div className="composer-actions">
            {isStreaming ? (
              <button
                type="button"
                className="send-button"
                aria-label="Stop generating"
                title="Stop generating"
                onClick={onStop}
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                className="send-button"
                aria-label="Send"
                title="Send"
                disabled={!value.trim()}
              >
                <ArrowUp size={17} />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
});
