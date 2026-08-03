import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("boots the bounded Clio foundation", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Clio" })).toBeInTheDocument();
    expect(screen.getByText(/ready for the application shell/i)).toBeInTheDocument();
  });
});
