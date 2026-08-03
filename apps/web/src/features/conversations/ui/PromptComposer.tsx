import {
  ArrowUp,
  Blocks,
  BookOpen,
  ChevronDown,
  Paperclip,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import {
  forwardRef,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { SkillCatalogItem } from "./catalog";

type PromptComposerProps = {
  compact?: boolean;
  isStreaming: boolean;
  skills: SkillCatalogItem[];
  selectedSkill: SkillCatalogItem | null;
  value: string;
  onOpenConnectors: () => void;
  onOpenContext: () => void;
  onOpenSkills: () => void;
  onStop: () => void;
  onSubmit: () => void;
  onRemoveSkill: () => void;
  onSelectSkill: (skill: SkillCatalogItem) => void;
  onValueChange: (value: string) => void;
};

export const PromptComposer = forwardRef<
  HTMLTextAreaElement,
  PromptComposerProps
>(function PromptComposer(
  {
    compact = false,
    isStreaming,
    skills,
    selectedSkill,
    value,
    onOpenConnectors,
    onOpenContext,
    onOpenSkills,
    onStop,
    onSubmit,
    onRemoveSkill,
    onSelectSkill,
    onValueChange,
  },
  textareaRef,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [commandMenuDismissed, setCommandMenuDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const commandMatch = value.match(/^\/([^\s]*)$/);
  const commandQuery = commandMatch?.[1].toLowerCase() ?? "";
  const matchingCommands = useMemo(
    () =>
      commandMatch
        ? skills.filter((skill) =>
            `${skill.command} ${skill.title} ${skill.description}`
              .toLowerCase()
              .includes(commandQuery),
          )
        : [],
    [commandMatch, commandQuery, skills],
  );
  const commandMenuOpen =
    !commandMenuDismissed &&
    Boolean(commandMatch) &&
    matchingCommands.length > 0;

  useEffect(() => {
    setActiveCommandIndex(0);
    setCommandMenuDismissed(false);
    setActionMenuOpen(false);
  }, [value]);

  useEffect(() => {
    if (!value) {
      setExpanded(false);
    }
  }, [value]);

  useEffect(() => {
    if (!actionMenuOpen) {
      return;
    }
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setActionMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [actionMenuOpen]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!value.trim() || isStreaming) {
      return;
    }
    onSubmit();
  };

  const selectCommand = (skill: SkillCatalogItem) => {
    onSelectSkill(skill);
    onValueChange("");
    setCommandMenuDismissed(true);
  };

  const runAction = (action: () => void) => {
    setActionMenuOpen(false);
    action();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (actionMenuOpen && event.key === "Escape") {
      event.preventDefault();
      setActionMenuOpen(false);
      return;
    }

    if (commandMenuOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveCommandIndex(
          (current) => (current + 1) % matchingCommands.length,
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveCommandIndex(
          (current) =>
            (current - 1 + matchingCommands.length) % matchingCommands.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        selectCommand(matchingCommands[activeCommandIndex]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setCommandMenuDismissed(true);
        return;
      }
    }

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
      ref={rootRef}
    >
      {commandMenuOpen ? (
        <div
          className="command-menu"
          id="skill-command-menu"
          role="listbox"
          aria-label="Skills"
        >
          {matchingCommands.map((skill, index) => {
            const Icon = skill.icon;
            const active = index === activeCommandIndex;
            return (
              <button
                type="button"
                role="option"
                id={`skill-command-${skill.id}`}
                aria-selected={active}
                className={`command-item${active ? " is-active" : ""}`}
                key={skill.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectCommand(skill)}
              >
                <span className="command-icon">
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <span className="command-copy">
                  <strong>/{skill.command}</strong>
                  <span>{skill.title}</span>
                  <small>{skill.description}</small>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {actionMenuOpen ? (
        <div
          className="composer-menu"
          id="composer-action-menu"
          role="menu"
          aria-label="Add to chat"
        >
          <button
            type="button"
            role="menuitem"
            className="composer-menu-item is-active"
            onClick={() => runAction(onOpenContext)}
          >
            <span className="composer-menu-icon">
              <BookOpen size={19} strokeWidth={1.8} />
            </span>
            <span>
              <strong>Build Packet</strong>
              <small>Open the live planning artifact</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="composer-menu-item"
            onClick={() => runAction(onOpenSkills)}
          >
            <span className="composer-menu-icon">
              <Sparkles size={19} strokeWidth={1.8} />
            </span>
            <span>
              <strong>Skills</strong>
              <small>Choose a build workflow</small>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="composer-menu-item"
            onClick={() => runAction(onOpenConnectors)}
          >
            <span className="composer-menu-icon">
              <Blocks size={19} strokeWidth={1.8} />
            </span>
            <span>
              <strong>Connectors</strong>
              <small>Use connected tools and services</small>
            </span>
          </button>
        </div>
      ) : null}

      <form
        className={`composer${selectedSkill ? " has-selected-skill" : ""}`}
        onSubmit={submit}
      >
        {selectedSkill ? (
          <div className="selected-skill" aria-label={`Skill: ${selectedSkill.title}`}>
            <selectedSkill.icon size={15} strokeWidth={1.8} />
            <span>{selectedSkill.title}</span>
            <button
              type="button"
              aria-label={`Remove ${selectedSkill.title}`}
              title="Remove skill"
              onClick={onRemoveSkill}
            >
              <X size={14} strokeWidth={1.8} />
            </button>
          </div>
        ) : null}
        <textarea
          ref={textareaRef}
          aria-label="Message"
          aria-controls={commandMenuOpen ? "skill-command-menu" : undefined}
          aria-expanded={commandMenuOpen}
          aria-activedescendant={
            commandMenuOpen
              ? `skill-command-${matchingCommands[activeCommandIndex].id}`
              : undefined
          }
          placeholder={compact ? "Follow up" : "Message Clio"}
          rows={1}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onInput={(event) => {
            const input = event.currentTarget;
            input.style.height = compact ? "24px" : "48px";
            const nextHeight = Math.min(input.scrollHeight, 160);
            input.style.height = `${nextHeight}px`;
            setExpanded(compact && nextHeight > 24);
          }}
          onKeyDown={handleKeyDown}
        />

        <div className="composer-toolbar">
          <button
            type="button"
            className="composer-icon"
            aria-label="Add files and tools"
            title="Add files and tools"
            aria-controls="composer-action-menu"
            aria-expanded={actionMenuOpen}
            onClick={() => {
              setCommandMenuDismissed(true);
              setActionMenuOpen((current) => !current);
            }}
          >
            <Paperclip size={19} strokeWidth={1.8} />
          </button>

          <div className="composer-actions">
            <span className="composer-mode" aria-label="Agent mode: Auto">
              Auto
              <ChevronDown size={15} strokeWidth={1.8} />
            </span>
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
                <ArrowUp size={19} />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
});
