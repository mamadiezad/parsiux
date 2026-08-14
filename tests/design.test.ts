import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDesign, persistDesign } from "../src/lib/design.js";

test("creates RTL tokens and persistent design files", async () => {
  const directory = await mkdtemp(join(tmpdir(), "parsiux-design-"));
  try {
    const design = await createDesign("یک درگاه پرداخت امن", "nextjs", "پرداخت امن");
    assert.equal(design.product.id, "payment-fintech");
    assert.equal((design.tokens.meta as { direction: string }).direction, "rtl");
    const output = await persistDesign(design, directory);
    assert.match(await readFile(output.master, "utf8"), /پرداخت امن/);
    assert.equal(JSON.parse(await readFile(output.tokens, "utf8")).meta.locale, "fa-IR");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
