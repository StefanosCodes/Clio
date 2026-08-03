import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { organizationKey } from "../shared/api/clioApi";

const sourceRoot = resolve(import.meta.dirname, "..");

describe("application shell state boundaries", () => {
  it("puts organization identity first in every generated query key", () => {
    expect(organizationKey("fixture-acme", "conversation", "123")).toEqual([
      "organization",
      "fixture-acme",
      "conversation",
      "123",
    ]);
  });

  it("keeps the fixture switch abort/hide/reset/reload protocol explicit", () => {
    const source = readFileSync(
      resolve(sourceRoot, "entities/organization/FixtureOrganizationContext.tsx"),
      "utf8",
    );
    expect(source).toContain("setSwitching(true)");
    expect(source).toContain("controller.abort(\"organization-switch\")");
    expect(source).toContain("queryClient.cancelQueries");
    expect(source).toContain("queryClient.removeQueries");
    expect(source).toContain("setScopeEpoch");
    expect(source).toContain("setOrganizationId");
  });

  it("does not optimistically declare packet success", () => {
    const source = readFileSync(resolve(sourceRoot, "app/App.tsx"), "utf8");
    expect(source).not.toContain("onMutate:");
    expect(source).toContain("Version conflict or save failure");
  });
});
