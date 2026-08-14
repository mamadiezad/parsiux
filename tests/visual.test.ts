import assert from "node:assert/strict";
import test from "node:test";
import { parseViewports, visualMarkdown, type VisualAuditReport } from "../src/lib/visual.js";

test("parses custom viewports without duplicates", () => {
  const viewports = parseViewports("375, 768, 375, 1440");
  assert.deepEqual(viewports.map((item) => item.width), [375, 768, 1440]);
});

test("rejects invalid viewport input", () => {
  assert.throws(() => parseViewports("120,wrong"), /viewport/);
});

test("renders a Persian visual report with screenshots", () => {
  const report: VisualAuditReport = {
    target: "https://example.test",
    outputDirectory: "/tmp/report",
    generatedAt: "2026-08-14T00:00:00.000Z",
    summary: { error: 0, warning: 1, info: 0 },
    score: 93,
    viewports: [{
      viewport: { width: 375, height: 812, name: "mobile-375" },
      screenshot: "mobile-375.png",
      score: 93,
      findings: [{ id: "focus", severity: "warning", title: "focus", detail: "توضیح", fix: "اصلاح" }]
    }]
  };
  const markdown = visualMarkdown(report);
  assert.match(markdown, /mobile-375.png/);
  assert.match(markdown, /امتیاز میانگین/);
  assert.match(markdown, /WARNING/);
});
