import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ChatView } from "./ChatView";
import type { ChatSession } from "./types";

const populatedSession: ChatSession = {
  id: "conversation-1",
  title: "Planning conversation",
  status: "active",
  pinned: false,
  archivedAt: null,
  updatedAt: Date.now(),
  messages: [
    {
      id: "message-1",
      role: "user",
      status: "completed",
      content: "Plan a beta rollout",
      startedAt: Date.now(),
      finishedAt: Date.now(),
      steps: [],
      tools: [],
      sources: [],
    },
  ],
};

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

afterEach(cleanup);

describe("ChatView", () => {
  it("does not expose composer tools in first-run chat", () => {
    const props = {
      focusPacketCard: false,
      isStreaming: false,
      openActivityMessageId: null,
      packet: null,
      packetCreationError: false,
      packetCreationPending: false,
      onCreatePacket: vi.fn(),
      onOpenActivity: vi.fn(),
      onOpenPacket: vi.fn(),
      onSend: vi.fn(),
      onStop: vi.fn(),
    };

    render(
      <ChatView
        {...props}
        session={{ ...populatedSession, id: "empty", messages: [] }}
      />,
    );

    expect(screen.queryByRole("button", { name: "Open tools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add files and tools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menu", { name: "Tools" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /Build Packet/i }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Message" }), {
      target: { value: "/" },
    });
    expect(screen.queryByRole("listbox", { name: "Skills" })).not.toBeInTheDocument();
  });

  it("keeps composer actions removed after the conversation has context", () => {
    const onCreatePacket = vi.fn();
    const props = {
      focusPacketCard: false,
      isStreaming: false,
      openActivityMessageId: null,
      packet: null,
      packetCreationError: false,
      packetCreationPending: false,
      onCreatePacket,
      onOpenActivity: vi.fn(),
      onOpenPacket: vi.fn(),
      onSend: vi.fn(),
      onStop: vi.fn(),
    };

    render(<ChatView {...props} session={populatedSession} />);

    expect(screen.queryByRole("button", { name: "Open tools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add files and tools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Build Packet/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Build Packet/i }));
    expect(onCreatePacket).toHaveBeenCalledOnce();
  });

  it("keeps packet creation out of the composer while a turn is streaming", () => {
    render(
      <ChatView
        focusPacketCard={false}
        isStreaming
        openActivityMessageId={null}
        packet={null}
        packetCreationError={false}
        packetCreationPending={false}
        session={populatedSession}
        onCreatePacket={vi.fn()}
        onOpenActivity={vi.fn()}
        onOpenPacket={vi.fn()}
        onSend={vi.fn()}
        onStop={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Build Packet/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop generating" })).toBeInTheDocument();
  });
});
