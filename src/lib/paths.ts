import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
