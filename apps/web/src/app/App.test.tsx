import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fixtureOrganizationFromPathname } from "../entities/organization/FixtureOrganizationContext";
import { App } from "./App";

describe("App", () => {
  it("boots the compact-navigation split workspace with honest fixture authority", () => {
    render(<App />);
    const expandSidebar = screen.getByRole("button", { name: "Expand sidebar" });
    expect(expandSidebar).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Chat" })).toBeInTheDocument();
    fireEvent.click(expandSidebar);
    expect(screen.getByText("Fixture organization · M1")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /what's on the agenda today/i }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Message Clio")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Build Packet" })).toBeInTheDocument();
    const separator = screen.getByRole("separator", {
      name: "Resize conversation and Build Packet panes",
    });
    expect(separator).toHaveAttribute("aria-valuenow", "48");
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator).toHaveAttribute("aria-valuenow", "52");
  });

  it("restores the fixture organization encoded in a durable URL", () => {
    expect(
      fixtureOrganizationFromPathname(
        "/organizations/fixture-orbit/conversations/saved-conversation",
      ),
    ).toBe("fixture-orbit");
    expect(fixtureOrganizationFromPathname("/organizations/not-allowed")).toBe(
      "fixture-acme",
    );
  });
});
