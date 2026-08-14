import assert from "node:assert/strict";
import test from "node:test";
import { expandQuery, normalizePersian, tokenize } from "../src/lib/normalize.js";

test("normalizes Arabic variants, Persian digits and whitespace", () => {
  assert.equal(normalizePersian("  كیف‌پول ۱۲۳  "), "کیف پول 123");
});

test("expands Persian commerce intent", () => {
  const terms = expandQuery("طراحی فروشگاه اینترنتی");
  assert.ok(terms.includes("فروشگاه"));
  assert.ok(terms.includes("سبد"));
  assert.ok(tokenize("رابط کاربری فارسی").includes("فارسی"));
});
