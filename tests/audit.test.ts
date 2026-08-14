import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditPath } from "../src/lib/audit.js";

test("reports missing RTL root and physical properties", async () => {
  const directory = await mkdtemp(join(tmpdir(), "parsiux-audit-"));
  try {
    await writeFile(join(directory, "index.html"), "<html><head></head><body><div class='ml-4'>سلام</div></body></html>", "utf8");
    await writeFile(join(directory, "app.css"), ".card { margin-left: 1rem; text-align: left; }", "utf8");
    const report = await auditPath(directory);
    assert.ok(report.summary.error >= 1);
    assert.ok(report.findings.some((item) => item.id === "physical-css"));
    assert.ok(report.findings.some((item) => item.id === "physical-tailwind"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("accepts a basic RTL page", async () => {
  const directory = await mkdtemp(join(tmpdir(), "parsiux-audit-"));
  try {
    await writeFile(join(directory, "index.html"), "<html lang='fa' dir='rtl'><head><meta name='viewport' content='width=device-width'></head><body class='font-[Vazirmatn]'><main>سلام</main></body></html>", "utf8");
    const report = await auditPath(directory);
    assert.equal(report.summary.error, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
