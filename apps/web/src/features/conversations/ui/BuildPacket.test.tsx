import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BuildPacketCard,
  BuildPacketDrawer,
  BuildPacketPane,
  BuildPacketWorkspace,
} from "./BuildPacket";

const packet = {
  version: 3,
  content: {
    outcome: "Give invited customers a guided path to first value.",
    audience: "Acme Studio",
    status: "Draft",
  },
};

const packetWithInternalMetadata = {
  ...packet,
  content: {
    ...packet.content,
    source_conversation: "conversation-123",
  },
};

afterEach(cleanup);

describe("Build Packet presentation", () => {
  it("keeps the saved artifact in chat and opens it from one card", () => {
    const onOpen = vi.fn();
    render(<BuildPacketCard packet={packet} onOpen={onOpen} />);

    expect(screen.getByText("Build Packet")).toBeInTheDocument();
    expect(screen.getByText("Draft · Version 3")).toBeInTheDocument();
    expect(screen.getByText(packet.content.outcome)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("does not count internal persistence metadata as a visible section", () => {
    render(
      <BuildPacketCard
        packet={packetWithInternalMetadata}
        onOpen={() => undefined}
      />,
    );

    expect(screen.getByText("3 sections · Saved")).toBeInTheDocument();
    expect(screen.queryByText("4 sections · Saved")).not.toBeInTheDocument();
  });

  it("renders the Packet as a central document with a path back to chat", () => {
    const onBack = vi.fn();
    const onSave = vi.fn();
    render(
      <BuildPacketWorkspace
        canSave
        defaultContent={packet.content}
        error={false}
        packet={packet}
        saving={false}
        onBack={onBack}
        onSave={onSave}
      />,
    );

    expect(screen.getByRole("heading", { name: "Build Packet" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Outcome" })).toBeInTheDocument();
    expect(screen.queryByText(/fixture artifact|evaluation boundary/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to conversation" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Outcome" }), {
      target: { value: "Revised customer outcome" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save new version" }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "Revised customer outcome" }),
    );
  });

  it("uses plain product language for an empty Packet", () => {
    render(
      <BuildPacketWorkspace
        canSave
        defaultContent={packet.content}
        error={false}
        packet={null}
        saving={false}
        onBack={() => undefined}
        onSave={() => undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: "No Build Packet yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Build Packet" })).toBeInTheDocument();
    expect(screen.queryByText(/fixture packet/i)).not.toBeInTheDocument();
  });

  it("uses a persistent content pane with an explicit full-view action", () => {
    const onOpenFullView = vi.fn();
    render(
      <BuildPacketPane
        canSave
        defaultContent={packet.content}
        error={false}
        packet={packet}
        saving={false}
        onCloseMobile={() => undefined}
        onOpenFullView={onOpenFullView}
        onSave={() => undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: "Build Packet" })).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Open Build Packet full view" }),
    );
    expect(onOpenFullView).toHaveBeenCalledOnce();
  });

  it("fills missing legacy Packet fields from the current document template", () => {
    render(
      <BuildPacketPane
        canSave
        defaultContent={packet.content}
        error={false}
        packet={{ version: 1, content: { outcome: "Legacy outcome" } }}
        saving={false}
        onCloseMobile={() => undefined}
        onOpenFullView={() => undefined}
        onSave={() => undefined}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Outcome" })).toHaveValue(
      "Legacy outcome",
    );
    expect(screen.getByRole("textbox", { name: "Audience" })).toHaveValue(
      "Acme Studio",
    );
    expect(screen.getByRole("textbox", { name: "Status" })).toHaveValue("Draft");
  });
});
