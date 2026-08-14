#!/usr/bin/env node
import { resolve } from "node:path";
import { auditMarkdown, auditPath } from "./lib/audit.js";
import { createDesign, designMarkdown, persistDesign } from "./lib/design.js";
import { installSkill } from "./lib/init.js";
import { loadCatalog } from "./lib/catalog.js";
import { searchProducts } from "./lib/search.js";

type Parsed = { command: string; positionals: string[]; options: Record<string, string | boolean> };

function parse(argumentsList: string[]): Parsed {
  const [command = "help", ...rest] = argumentsList;
  const positionals: string[] = [];
  const options: Record<string, string | boolean> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    const [key, inline] = value.slice(2).split("=", 2);
    if (inline !== undefined) options[key] = inline;
    else if (rest[index + 1] && !rest[index + 1].startsWith("--")) {
      options[key] = rest[index + 1];
      index += 1;
    } else options[key] = true;
  }
  return { command, positionals, options };
}

function stringOption(options: Record<string, string | boolean>, name: string, fallback?: string): string | undefined {
  const value = options[name];
  return typeof value === "string" ? value : fallback;
}

function help(): string {
  return `ParsiUX — Persian-first UI/UX intelligence and RTL audit\n\nدستورها:\n  parsiux init --ai claude|cursor|universal|all --target .\n  parsiux search "فروشگاه پرداخت" [--max 5] [--json]\n  parsiux design "فروشگاه پوشاک" --stack nextjs --name "فروشگاه من" --output .\n  parsiux audit . [--json] [--strict]\n\nParsiUX ساخته شده برای رابط فارسی، RTL و AI coding assistantها.\nMade ❤️ by Mohammad — @llllxyz\n`;
}

async function run(): Promise<void> {
  const parsed = parse(process.argv.slice(2));
  if (["help", "--help", "-h"].includes(parsed.command)) {
    process.stdout.write(help());
    return;
  }
  if (parsed.command === "init") {
    const assistant = stringOption(parsed.options, "ai", "universal") as string;
    const target = stringOption(parsed.options, "target", ".") as string;
    const files = await installSkill(target, assistant);
    process.stdout.write(`ParsiUX skill نصب شد:\n${files.map((file) => `- ${file}`).join("\n")}\n`);
    return;
  }
  if (parsed.command === "search") {
    const query = parsed.positionals.join(" ");
    if (!query) throw new Error("برای search یک عبارت وارد کنید.");
    const catalog = await loadCatalog();
    const max = Number(stringOption(parsed.options, "max", "5"));
    const hits = searchProducts(catalog.products, query, Number.isFinite(max) ? Math.max(1, Math.min(max, 20)) : 5);
    if (parsed.options.json) {
      process.stdout.write(`${JSON.stringify(hits, null, 2)}\n`);
      return;
    }
    process.stdout.write(hits.length ? `${hits.map((hit, index) => `${index + 1}. ${hit.product.title}\n   ${hit.product.summary}\n   تطابق: ${hit.matchedTerms.join("، ")}`).join("\n\n")}\n` : "نتیجه‌ی مرتبطی پیدا نشد. عبارت محصول را دقیق‌تر بنویسید.\n");
    return;
  }
  if (parsed.command === "design") {
    const prompt = parsed.positionals.join(" ");
    if (!prompt) throw new Error("برای design شرح محصول را وارد کنید.");
    const result = await createDesign(prompt, stringOption(parsed.options, "stack", "nextjs"), stringOption(parsed.options, "name"));
    if (parsed.options.output) {
      const persisted = await persistDesign(result, resolve(stringOption(parsed.options, "output") as string));
      process.stderr.write(`فایل‌ها ساخته شدند:\n- ${persisted.master}\n- ${persisted.tokens}\n`);
    }
    process.stdout.write(parsed.options.json ? `${JSON.stringify(result, null, 2)}\n` : designMarkdown(result));
    return;
  }
  if (parsed.command === "audit") {
    const target = parsed.positionals[0] ?? ".";
    const report = await auditPath(target);
    process.stdout.write(parsed.options.json ? `${JSON.stringify(report, null, 2)}\n` : auditMarkdown(report));
    if (parsed.options.strict && (report.summary.error > 0 || report.summary.warning > 0)) process.exitCode = 1;
    return;
  }
  throw new Error(`دستور ناشناخته است: ${parsed.command}\n\n${help()}`);
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
