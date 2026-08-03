import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("boots the working shell with honest fixture authority", () => {
    render(<App />);
    expect(screen.getByText("Idea to accepted work")).toBeInTheDocument();
    expect(screen.getByText(/fixture authority · m1 only/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /what should we shape next/i })).toBeInTheDocument();
  });
});
