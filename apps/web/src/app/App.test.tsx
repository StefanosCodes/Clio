import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { fixtureOrganizationFromPathname } from "../entities/organization/FixtureOrganizationContext";
import { App } from "./App";

describe("App", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("boots compact navigation with a focused first-run chat", () => {
    render(<App />);
    const expandSidebar = screen.getByRole("button", { name: "Expand sidebar" });
    expect(expandSidebar).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Chat" })).toBeInTheDocument();
    fireEvent.click(expandSidebar);
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Knowledge Base" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Plugins" })).not.toBeInTheDocument();
    expect(screen.getByText("Fixture organization · M1")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /turn an idea into planned work/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Clio will shape the scope and evidence/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Describe what you want to build or change")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open tools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add files and tools" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Build Packet" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("button", { name: "Back to app" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search settings" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New Chat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recents" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Appearance" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Knowledge Base" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Plugins" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "General" })).toBeInTheDocument();
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

  it.each([
    ["knowledge", "Knowledge Base"],
    ["plugins", "Plugins"],
  ])("restores the legacy %s deep link inside Settings", (view, heading) => {
    window.history.replaceState({}, "", `/?view=${view}`);
    render(<App />);

    expect(screen.getByRole("button", { name: "Back to app" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  });
});
