import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { safeRtlFix } from "../src/lib/fix.js";
import { createGuardianSetup, loadGuardianConfig } from "../src/lib/guardian-config.js";
import { getProfile, listProfiles } from "../src/lib/profiles.js";
import { readinessAudit } from "../src/lib/readiness.js";

test("loads Persian rule packs", async () => {
  const profiles = await listProfiles();
  assert.ok(profiles.some((item) => item.id === "ecommerce-fa"));
  assert.equal((await getProfile("fintech-fa")).title, "پرداخت و فین‌تک");
});

test("reports Persian character and money formatting risks", async () => {
  const directory = await mkdtemp(join(tmpdir(), "parsiux-readiness-"));
  try {
    await writeFile(join(directory, "index.html"), "<html><body><p>قيمت 120000تومان</p><input type='text'></body></html>", "utf8");
    const report = await readinessAudit(directory, await getProfile("ecommerce-fa"));
    assert.ok(report.findings.some((item) => item.id === "persian-character-normalization"));
    assert.ok(report.findings.some((item) => item.id === "persian-money-spacing"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("applies only safe logical RTL replacements", async () => {
  const directory = await mkdtemp(join(tmpdir(), "parsiux-fix-"));
  const file = join(directory, "app.css");
  try {
    await writeFile(file, ".card { margin-left: 1rem; padding-right: 2rem; text-align: left; }", "utf8");
    const preview = await safeRtlFix(directory, false);
    assert.equal(preview.applied, false);
    assert.equal(preview.changes.length, 3);
    await safeRtlFix(directory, true);
    const result = await readFile(file, "utf8");
    assert.match(result, /margin-inline-start/);
    assert.match(result, /padding-inline-end/);
    assert.match(result, /text-align: start/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("creates Guardian config and GitHub workflow", async () => {
  const directory = await mkdtemp(join(tmpdir(), "parsiux-guardian-"));
  try {
    const setup = await createGuardianSetup(directory);
    const loaded = await loadGuardianConfig(setup.config);
    assert.equal(loaded.config.profile, "base-fa");
    assert.match(await readFile(setup.workflow, "utf8"), /ParsiUX Guardian/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
