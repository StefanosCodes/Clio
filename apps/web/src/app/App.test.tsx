import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { fixtureOrganizationFromPathname } from "../entities/organization/FixtureOrganizationContext";
import { App } from "./App";

describe("App", () => {
  it("boots the Rivet-fidelity shell with honest fixture authority", () => {
    render(<App />);
    expect(screen.getByText("Clio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Chat" })).toBeInTheDocument();
    expect(screen.getByText("Fixture organization · M1")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /what's on the agenda today/i }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Message Clio")).toBeInTheDocument();
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
