import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BuildPacketCard,
  BuildPacketDrawer,
  BuildPacketPane,
  BuildPacketWorkspace,
} from "./BuildPacket";
import { createBuildPacketTemplate } from "./packetTemplate";

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
    expect(screen.getByText("Saved · Version 3")).toBeInTheDocument();
    expect(screen.getByText(packet.content.outcome)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("does not present packet metadata as document sections", () => {
    render(
      <BuildPacketCard
        packet={packetWithInternalMetadata}
        onOpen={() => undefined}
      />,
    );

    expect(screen.getByText("Saved artifact")).toBeInTheDocument();
    expect(screen.queryByText(/sections/)).not.toBeInTheDocument();
  });

  it("renders the Packet as a central document with a path back to chat", () => {
    const onBack = vi.fn();
    render(
      <BuildPacketWorkspace
        canSave
        defaultContent={packet.content}
        error={false}
        packet={packet}
        saving={false}
        onBack={onBack}
        onSave={() => undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: "Build Packet" })).toBeInTheDocument();
    expect(screen.getByText(packet.content.outcome)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save new version" })).not.toBeInTheDocument();
    expect(screen.queryByText(/fixture artifact|evaluation boundary/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to conversation" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("shows a realistic structured Packet as a clean saved document", () => {
    const richPacket = {
      version: 2,
      content: createBuildPacketTemplate("Acme Studio"),
    };

    render(
      <BuildPacketPane
        canSave
        defaultContent={richPacket.content}
        error={false}
        packet={richPacket}
        saving={false}
        onCloseMobile={() => undefined}
        onOpenFullView={() => undefined}
        onSave={() => undefined}
      />,
    );

    expect(screen.getByText("Decision Flow")).toBeInTheDocument();
    expect(screen.getByLabelText("Build Packet diagram")).toBeInTheDocument();
    expect(screen.getByText("Milestones")).toBeInTheDocument();
    expect(screen.getByText("Acceptance Checks")).toBeInTheDocument();
    expect(screen.getByText("Connectors")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByText("Edit source")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save new version" })).not.toBeInTheDocument();
  });

  it("counts only rendered structured sections in the artifact card", () => {
    render(
      <BuildPacketCard
        packet={{ version: 2, content: createBuildPacketTemplate("Acme Studio") }}
        onOpen={() => undefined}
      />,
    );

    expect(screen.getByText("8 sections")).toBeInTheDocument();
  });

  it("renders canonical Markdown and Mermaid blocks as the Packet document", () => {
    render(
      <BuildPacketPane
        canSave
        defaultContent={{}}
        error={false}
        packet={{
          version: 1,
          content: {
            markdown: [
              "# Launch the planning workspace",
              "",
              "A complete Markdown Build Packet.",
              "",
              "## Acceptance criteria",
              "",
              "- The saved Packet is readable.",
              "- The diagram stays inline with the document.",
              "",
              "```mermaid",
              "flowchart LR",
              '  N0[\"Request\"] -->|clarify| N1[\"Accepted plan\"]',
              "```",
            ].join("\n"),
          },
        }}
        saving={false}
        onCloseMobile={() => undefined}
        onOpenFullView={() => undefined}
        onSave={() => undefined}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Launch the planning workspace" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Acceptance criteria" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByLabelText("Build Packet diagram")).toBeInTheDocument();
    expect(screen.queryByText("Markdown")).not.toBeInTheDocument();
  });

  it("falls back to source when any Mermaid line is unsupported", () => {
    render(
      <BuildPacketPane
        canSave
        defaultContent={{}}
        error={false}
        packet={{
          version: 1,
          content: {
            markdown: [
              "# Packet",
              "",
              "```mermaid",
              "flowchart LR",
              '  N0["Request"] --> N1["Plan"]',
              "  N1 --> N2",
              "```",
            ].join("\n"),
          },
        }}
        saving={false}
        onCloseMobile={() => undefined}
        onOpenFullView={() => undefined}
        onSave={() => undefined}
      />,
    );

    expect(screen.queryByLabelText("Build Packet diagram")).not.toBeInTheDocument();
    expect(screen.getByText(/N1 --> N2/)).toBeInTheDocument();
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

  it("renders the exact saved Packet without inventing fields from a newer template", () => {
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

    expect(screen.getByText("Legacy outcome")).toBeInTheDocument();
    expect(screen.queryByText("Acme Studio")).not.toBeInTheDocument();
    expect(screen.queryByText("Draft")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("keeps saved Packets read-only in the drawer too", () => {
    render(
      <BuildPacketDrawer
        canSave
        defaultContent={packet.content}
        error={false}
        packet={packet}
        saving={false}
        onClose={() => undefined}
        onOpenFullView={() => undefined}
        onSave={() => undefined}
      />,
    );

    expect(screen.getByText(packet.content.outcome)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit source")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save new version" })).not.toBeInTheDocument();
  });
});
