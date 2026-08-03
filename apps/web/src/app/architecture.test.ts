import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const sourceRoot = resolve(import.meta.dirname, "..");
const layerRank = new Map([
  ["app", 0],
  ["pages", 1],
  ["widgets", 2],
  ["features", 3],
  ["entities", 4],
  ["shared", 5],
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : [".ts", ".tsx"].includes(extname(path))
        ? [path]
        : [];
  });
}

describe("frontend dependency direction", () => {
  it("allows imports only toward lower-level slices", () => {
    for (const path of sourceFiles(sourceRoot)) {
      const sourceLayer = relative(sourceRoot, path).split("/")[0];
      const sourceRank = layerRank.get(sourceLayer);
      if (sourceRank === undefined) continue;
      const imports = [...readFileSync(path, "utf8").matchAll(/from\s+["']([^"']+)["']/g)];
      for (const [, specifier] of imports) {
        if (!specifier.startsWith(".")) continue;
        const target = resolve(path, "..", specifier);
        const targetLayer = relative(sourceRoot, target).split("/")[0];
        const targetRank = layerRank.get(targetLayer);
        if (targetRank !== undefined) {
          expect(
            targetRank,
            `${relative(sourceRoot, path)} imports upward into ${targetLayer}`,
          ).toBeGreaterThanOrEqual(sourceRank);
        }
      }
    }
  });

  it("keeps generated DTOs out of feature-local TypeScript", () => {
    for (const path of sourceFiles(join(sourceRoot, "features"))) {
      expect(readFileSync(path, "utf8")).not.toMatch(/type\s+.*(?:Request|Response|Dto)\s*=/);
    }
  });
});
