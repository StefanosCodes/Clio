#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pixelmatch from "pixelmatch";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { ssim } from "ssim.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceRoot = path.join(repositoryRoot, "docs/evidence/ui-fidelity");
const outputRoot = path.join(evidenceRoot, "regression-current");
const port = 4175;
const baseUrl = `http://127.0.0.1:${port}`;
const updateProductBaselines = process.env.UPDATE_CLIO_PRODUCT_BASELINES === "1";
const productionParity = {
  minimumSsim: 0.999,
  maximumPerceptualMismatchRatio: 0.001,
};

const cases = [
  { name: "empty-desktop-dark", state: "empty", width: 1440, height: 900, theme: "dark", baseline: "reference-clio-m1-empty-1440x900-dark.png", authority: "clio-product-contract" },
  { name: "empty-desktop-light", state: "empty", width: 1440, height: 900, theme: "light", baseline: "reference-clio-m1-empty-1440x900-light.png", authority: "clio-product-contract" },
  { name: "empty-mobile-dark", state: "empty", width: 390, height: 844, theme: "dark", baseline: "reference-clio-m1-empty-390x844-dark.png", authority: "clio-product-contract" },
  { name: "empty-mobile-light", state: "empty", width: 390, height: 844, theme: "light", baseline: "reference-clio-m1-empty-390x844-light.png", authority: "clio-product-contract" },
  { name: "populated-desktop-dark", state: "populated", width: 1280, height: 800, theme: "dark", baseline: "reference-clio-m1-populated-1280x800-dark.png", authority: "clio-product-contract" },
  { name: "populated-mobile-dark", state: "populated", width: 390, height: 844, theme: "dark", baseline: "reference-clio-m1-populated-390x844-dark.png", authority: "clio-product-contract" },
  { name: "populated-mobile-light", state: "populated", width: 390, height: 844, theme: "light", baseline: "reference-clio-m1-populated-390x844-light.png", authority: "clio-product-contract" },
  { name: "streaming-desktop-dark", state: "streaming", width: 1440, height: 900, theme: "dark", baseline: "reference-clio-m1-streaming-1440x900-dark.png", authority: "clio-product-contract" },
  { name: "disconnected-desktop-dark", state: "disconnected", width: 1440, height: 900, theme: "dark", baseline: "reference-clio-m1-disconnected-1440x900-dark.png", authority: "clio-product-contract" },
  { name: "cancelled-desktop-dark", state: "cancelled", width: 1440, height: 900, theme: "dark", baseline: "reference-clio-m1-cancelled-1440x900-dark.png", authority: "clio-product-contract" },
  { name: "failed-desktop-dark", state: "failed", width: 1440, height: 900, theme: "dark", baseline: "reference-clio-m1-failed-1440x900-dark.png", authority: "clio-product-contract" },
  { name: "loading-desktop-dark", state: "loading", width: 1440, height: 900, theme: "dark", baseline: "reference-clio-m1-loading-1440x900-dark.png", authority: "clio-product-contract" },
  { name: "workspace-desktop-dark", state: "packet-drawer", width: 1440, height: 900, theme: "dark", baseline: "reference-clio-product-workspace-1440x900-dark.png", authority: "clio-product-contract", heading: "Build Packet" },
  { name: "workspace-desktop-light", state: "packet-drawer", width: 1440, height: 900, theme: "light", baseline: "reference-clio-product-workspace-1440x900-light.png", authority: "clio-product-contract", heading: "Build Packet" },
  { name: "packet-workspace-desktop-dark", state: "packet-workspace", width: 1440, height: 900, theme: "dark", baseline: "reference-clio-product-packet-workspace-1440x900-dark.png", authority: "clio-product-contract", heading: "Build Packet" },
  { name: "activity-rail-desktop-dark", state: "activity", width: 1440, height: 900, theme: "dark", baseline: "reference-clio-product-activity-rail-1440x900-dark.png", authority: "clio-product-contract", dialog: "Activity" },
  { name: "workspace-mobile-light", state: "packet-drawer", width: 390, height: 844, theme: "light", baseline: "reference-clio-product-workspace-390x844-light.png", authority: "clio-product-contract", heading: "Build Packet" },
  { name: "activity-rail-mobile-dark", state: "activity", width: 390, height: 844, theme: "dark", baseline: "reference-clio-product-activity-rail-390x844-dark.png", authority: "clio-product-contract", dialog: "Activity" },
  { name: "packet-starter-desktop-dark", state: "populated", width: 1440, height: 900, theme: "dark", baseline: "reference-clio-product-packet-starter-1440x900-dark.png", authority: "clio-product-contract", button: "Build Packet" },
  { name: "expanded-desktop-dark", state: "empty", width: 1440, height: 900, theme: "dark", baseline: "reference-clio-m1-expanded-1440x900-dark.png", authority: "clio-product-contract", legacyShell: true },
  { name: "mobile-open-dark", state: "empty", width: 390, height: 844, theme: "dark", baseline: "reference-clio-m1-mobile-open-390x844-dark.png", authority: "clio-product-contract", mobileOpen: true },
  { name: "settings-knowledge-desktop-dark", state: "empty", width: 1440, height: 900, theme: "dark", baseline: "reference-clio-product-settings-knowledge-1440x900-dark.png", authority: "clio-product-contract", settingsSection: "knowledge" },
  { name: "settings-plugins-desktop-dark", state: "empty", width: 1440, height: 900, theme: "dark", baseline: "reference-clio-product-settings-plugins-1440x900-dark.png", authority: "clio-product-contract", settingsSection: "plugins" },
];

function referencePath(testCase) {
  return path.join(evidenceRoot, testCase.baseline);
}

async function waitForServer(server) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Vite exited before readiness with code ${server.exitCode}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The bounded local server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

function compare(referenceFile, candidateFile) {
  const reference = PNG.sync.read(fs.readFileSync(referenceFile));
  const candidate = PNG.sync.read(fs.readFileSync(candidateFile));
  if (reference.width !== candidate.width || reference.height !== candidate.height) {
    throw new Error(
      `Canvas mismatch: ${reference.width}x${reference.height} vs ${candidate.width}x${candidate.height}`,
    );
  }

  const diff = new PNG({ width: reference.width, height: reference.height });
  const perceptualMismatchPixels = pixelmatch(
    reference.data,
    candidate.data,
    diff.data,
    reference.width,
    reference.height,
    { threshold: 0.1, includeAA: false },
  );
  const similarity = ssim(
    { data: reference.data, width: reference.width, height: reference.height },
    { data: candidate.data, width: candidate.width, height: candidate.height },
  ).mssim;
  const totalPixels = reference.width * reference.height;
  return {
    width: reference.width,
    height: reference.height,
    totalPixels,
    ssim: similarity,
    perceptualMismatchPixels,
    perceptualMismatchRatio: perceptualMismatchPixels / totalPixels,
    diff,
  };
}

async function main() {
  fs.mkdirSync(outputRoot, { recursive: true });
  for (const testCase of cases) {
    const baseline = referencePath(testCase);
    const productBaselineCanBeCreated =
      testCase.authority === "clio-product-contract" && updateProductBaselines;
    if (!fs.existsSync(baseline) && !productBaselineCanBeCreated) {
      throw new Error(`Missing immutable baseline: ${baseline}`);
    }
  }

  const server = spawn(
    "npm",
    [
      "run",
      "dev",
      "--workspace",
      "@clio/web",
      "--",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: repositoryRoot,
      env: { ...process.env, NO_COLOR: "1" },
      stdio: "ignore",
    },
  );

  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    await waitForServer(server);
    for (const testCase of cases) {
      const context = await browser.newContext({
        viewport: { width: testCase.width, height: testCase.height },
        deviceScaleFactor: 1,
        colorScheme: testCase.theme,
        reducedMotion: "reduce",
        locale: "en-US",
        timezoneId: "UTC",
      });
      const page = await context.newPage();
      const parameters = new URLSearchParams({
        uiFixture: testCase.state,
        theme: testCase.theme,
      });
      if (testCase.collapsed) parameters.set("collapsed", "1");
      if (testCase.legacyShell) parameters.set("legacyShell", "1");
      if (testCase.mobileOpen) parameters.set("mobile", "open");
      if (testCase.settingsSection) {
        parameters.set("view", "settings");
        parameters.set("section", testCase.settingsSection);
      }
      await page.goto(`${baseUrl}/?${parameters}`, { waitUntil: "networkidle" });
      if (testCase.settingsSection) {
        await page
          .getByRole("heading", {
            name:
              testCase.settingsSection === "knowledge" ? "Knowledge Base" : "Plugins",
          })
          .waitFor();
      } else if (testCase.button) {
        await page.getByRole("button", { name: new RegExp(testCase.button) }).waitFor();
      } else if (testCase.heading) {
        await page.getByRole("heading", { name: testCase.heading }).waitFor();
      } else {
        await page.getByRole("textbox", { name: "Message" }).waitFor();
      }
      if (testCase.dialog) {
        await page.getByRole("dialog", { name: new RegExp(testCase.dialog) }).waitFor();
      }
      await page.evaluate(async () => {
        await document.fonts?.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      // Rivet's shell/drawer transitions are 180ms; capture only their settled frame.
      await page.waitForTimeout(220);

      const candidateFile = path.join(outputRoot, `${testCase.name}.png`);
      await page.screenshot({
        path: candidateFile,
        type: "png",
        animations: "disabled",
        caret: "hide",
      });
      await context.close();

      if (
        testCase.authority === "clio-product-contract" &&
        updateProductBaselines
      ) {
        fs.copyFileSync(candidateFile, referencePath(testCase));
      }

      const metrics = compare(referencePath(testCase), candidateFile);
      const diffFile = path.join(outputRoot, `${testCase.name}.diff.png`);
      fs.writeFileSync(diffFile, PNG.sync.write(metrics.diff));
      const passed =
        metrics.ssim >= productionParity.minimumSsim &&
        metrics.perceptualMismatchRatio <=
          productionParity.maximumPerceptualMismatchRatio;
      results.push({
        case: testCase.name,
        authority: testCase.authority ?? "rivet-reference",
        reference: path.relative(repositoryRoot, referencePath(testCase)),
        candidate: path.relative(repositoryRoot, candidateFile),
        diff: path.relative(repositoryRoot, diffFile),
        ssim: Number(metrics.ssim.toFixed(9)),
        perceptualMismatchPixels: metrics.perceptualMismatchPixels,
        perceptualMismatchRatio: Number(metrics.perceptualMismatchRatio.toFixed(9)),
        status: passed ? "production-parity" : "fail",
      });
    }
  } finally {
    await browser.close();
    server.kill("SIGTERM");
  }

  const report = {
    generatedAt: new Date().toISOString(),
    thresholds: productionParity,
    masks: [],
    cases: results,
  };
  fs.writeFileSync(
    path.join(outputRoot, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (results.some((result) => result.status !== "production-parity")) {
    process.exitCode = 1;
  }
}

await main();
