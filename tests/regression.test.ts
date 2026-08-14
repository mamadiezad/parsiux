import assert from "node:assert/strict";
import test from "node:test";
import { baselineSlug, regressionMarkdown, type RegressionReport } from "../src/lib/regression.js";

test("creates stable baseline slugs for Persian names", () => {
  assert.equal(baselineSlug(" صفحه نخست فروشگاه "), "صفحه-نخست-فروشگاه");
  assert.equal(baselineSlug("RTL Gallery 01"), "rtl-gallery-01");
  assert.throws(() => baselineSlug("---"), /baseline/);
});

test("renders a failing visual regression report", () => {
  const report: RegressionReport = {
    target: "https://example.test",
    baselineDirectory: "/tmp/baseline",
    outputDirectory: "/tmp/report",
    generatedAt: "2026-08-14T00:00:00.000Z",
    maxDifference: 0.01,
    pass: false,
    summary: { error: 1, warning: 0, info: 0 },
    visualReport: {
      target: "https://example.test",
      outputDirectory: "/tmp/current",
      generatedAt: "2026-08-14T00:00:00.000Z",
      score: 100,
      summary: { error: 0, warning: 0, info: 0 },
      viewports: []
    },
    snapshots: [{
      viewport: { width: 375, height: 812, name: "mobile-375" },
      baseline: "baseline/mobile-375.png",
      current: "current/mobile-375.png",
      diff: "diff/mobile-375.png",
      changedPixels: 120,
      totalPixels: 10000,
      differenceRatio: 0.012,
      severity: "error",
      detail: "تغییر بیش از حد مجاز است."
    }]
  };
  const markdown = regressionMarkdown(report);
  assert.match(markdown, /FAIL/);
  assert.match(markdown, /diff\/mobile-375.png/);
  assert.match(markdown, /1.200%/);
});
