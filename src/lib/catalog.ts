import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { packageRoot } from "./paths.js";
import type { Catalog } from "../types.js";

let cachedCatalog: Catalog | undefined;

export async function loadCatalog(): Promise<Catalog> {
  if (cachedCatalog) return cachedCatalog;
  const raw = await readFile(join(packageRoot, "data", "catalog.fa.json"), "utf8");
  cachedCatalog = JSON.parse(raw) as Catalog;
  return cachedCatalog;
}
