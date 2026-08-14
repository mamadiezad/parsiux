import assert from "node:assert/strict";
import test from "node:test";
import { loadCatalog } from "../src/lib/catalog.js";
import { searchProducts } from "../src/lib/search.js";

test("finds e-commerce from a Persian request", async () => {
  const catalog = await loadCatalog();
  const result = searchProducts(catalog.products, "برای فروشگاه آنلاین لباس طراحی می‌خواهم", 1);
  assert.equal(result[0]?.product.id, "ecommerce");
});

test("finds booking from English intent", async () => {
  const catalog = await loadCatalog();
  const result = searchProducts(catalog.products, "appointment booking calendar", 1);
  assert.equal(result[0]?.product.id, "booking");
});
