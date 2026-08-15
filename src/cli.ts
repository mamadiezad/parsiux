#!/usr/bin/env node
import { resolve } from "node:path";
import { auditMarkdown, auditPath } from "./lib/audit.js";
import { createDesign, designMarkdown, persistDesign } from "./lib/design.js";
import { installSkill } from "./lib/init.js";
import { loadCatalog } from "./lib/catalog.js";
import { searchProducts } from "./lib/search.js";
import { parseViewports, visualAudit, visualMarkdown } from "./lib/visual.js";
import { compareBaseline, createBaseline, regressionMarkdown } from "./lib/regression.js";
import { createGuardianSetup, loadGuardianConfig } from "./lib/guardian-config.js";
import { githubAnnotations, gateMarkdown, runGate, writeGitHubSummary } from "./lib/gate.js";
import { listProfiles, profilesMarkdown } from "./lib/profiles.js";
import { fixMarkdown, safeRtlFix } from "./lib/fix.js";

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
  return `ParsiUX — Persian-first UI/UX intelligence and RTL audit\n\nدستورها:\n  parsiux init --ai claude|cursor|universal|all --target .\n  parsiux init --ci --target .\n  parsiux profiles\n  parsiux search "فروشگاه پرداخت" [--max 5] [--json]\n  parsiux design "فروشگاه پوشاک" --stack nextjs --name "فروشگاه من" --output .\n  parsiux audit . [--json] [--strict]\n  parsiux fix . [--apply]\n  parsiux visual https://example.com --output ./parsiux-visual-report --viewports 375,768,1440 [--strict]\n  parsiux baseline https://example.com --name homepage --output .parsiux/baselines\n  parsiux compare https://example.com --baseline .parsiux/baselines/homepage --output ./parsiux-regression-report --strict\n  parsiux gate --config parsiux.config.json [--github] [--strict]\n\nبرای visual audit یک‌بار Chromium را نصب کن: npx playwright install chromium\nParsiUX ساخته شده برای رابط فارسی، RTL و AI coding assistantها.\nMade ❤️ by Mohammad — @llllxyz\n`;
}

async function run(): Promise<void> {
  const parsed = parse(process.argv.slice(2));
  if (["help", "--help", "-h"].includes(parsed.command)) {
    process.stdout.write(help());
    return;
  }
  if (parsed.command === "init") {
    const target = stringOption(parsed.options, "target", ".") as string;
    if (parsed.options.ci === true) {
      const setup = await createGuardianSetup(target, { force: parsed.options.force === true });
      process.stdout.write(`ParsiUX Guardian CI آماده شد:\n- ${setup.config}\n- ${setup.workflow}\n`);
      return;
    }
    const assistant = stringOption(parsed.options, "ai", "universal") as string;
    const files = await installSkill(target, assistant);
    process.stdout.write(`ParsiUX skill نصب شد:\n${files.map((file) => `- ${file}`).join("\n")}\n`);
    return;
  }
  if (parsed.command === "profiles") {
    const profiles = await listProfiles();
    process.stdout.write(parsed.options.json ? `${JSON.stringify(profiles, null, 2)}\n` : profilesMarkdown(profiles));
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
  if (parsed.command === "fix") {
    const target = parsed.positionals[0] ?? ".";
    const report = await safeRtlFix(target, parsed.options.apply === true);
    process.stdout.write(parsed.options.json ? `${JSON.stringify(report, null, 2)}\n` : fixMarkdown(report));
    return;
  }
  if (parsed.command === "visual") {
    const target = parsed.positionals[0];
    if (!target) throw new Error("برای visual یک URL یا مسیر فایل HTML وارد کنید.");
    const timeoutValue = Number(stringOption(parsed.options, "timeout", "15000"));
    const report = await visualAudit(target, {
      outputDirectory: stringOption(parsed.options, "output"),
      viewports: parseViewports(stringOption(parsed.options, "viewports")),
      timeout: Number.isFinite(timeoutValue) ? timeoutValue : 15000
    });
    process.stderr.write(`گزارش و screenshotها در ${report.outputDirectory} ساخته شدند.\n`);
    process.stdout.write(parsed.options.json ? `${JSON.stringify(report, null, 2)}\n` : visualMarkdown(report));
    if (parsed.options.strict && (report.summary.error > 0 || report.summary.warning > 0)) process.exitCode = 1;
    return;
  }
  if (parsed.command === "baseline") {
    const target = parsed.positionals[0];
    const name = stringOption(parsed.options, "name");
    if (!target || !name) throw new Error("برای baseline یک URL یا مسیر و --name وارد کنید.");
    const timeoutValue = Number(stringOption(parsed.options, "timeout", "15000"));
    const baseline = await createBaseline(target, name, {
      outputDirectory: stringOption(parsed.options, "output"),
      force: parsed.options.force === true,
      viewports: parseViewports(stringOption(parsed.options, "viewports")),
      timeout: Number.isFinite(timeoutValue) ? timeoutValue : 15000
    });
    process.stderr.write(`baseline در ${baseline.directory} ساخته شد.\n`);
    process.stdout.write(parsed.options.json ? `${JSON.stringify(baseline, null, 2)}\n` : visualMarkdown(baseline.report));
    if (parsed.options.strict && (baseline.report.summary.error > 0 || baseline.report.summary.warning > 0)) process.exitCode = 1;
    return;
  }
  if (parsed.command === "compare") {
    const target = parsed.positionals[0];
    const baseline = stringOption(parsed.options, "baseline");
    if (!target || !baseline) throw new Error("برای compare یک URL یا مسیر و --baseline وارد کنید.");
    const maxDifference = Number(stringOption(parsed.options, "max-diff", "0.01"));
    const timeoutValue = Number(stringOption(parsed.options, "timeout", "15000"));
    const report = await compareBaseline(target, baseline, {
      outputDirectory: stringOption(parsed.options, "output"),
      maxDifference: Number.isFinite(maxDifference) ? maxDifference : 0.01,
      timeout: Number.isFinite(timeoutValue) ? timeoutValue : 15000
    });
    process.stderr.write(`گزارش regression در ${report.outputDirectory} ساخته شد.\n`);
    process.stdout.write(parsed.options.json ? `${JSON.stringify(report, null, 2)}\n` : regressionMarkdown(report));
    if (parsed.options.strict && (!report.pass || report.visualReport.summary.error > 0 || report.visualReport.summary.warning > 0)) process.exitCode = 1;
    return;
  }
  if (parsed.command === "gate") {
    const loaded = await loadGuardianConfig(stringOption(parsed.options, "config"));
    const config = { ...loaded.config };
    const profile = stringOption(parsed.options, "profile");
    const staticTarget = stringOption(parsed.options, "static-target");
    const visualTarget = stringOption(parsed.options, "target");
    const baseline = stringOption(parsed.options, "baseline");
    const output = stringOption(parsed.options, "output");
    const maxDifference = Number(stringOption(parsed.options, "max-diff", String(config.maxDifference)));
    if (profile) config.profile = profile;
    if (staticTarget) config.staticTarget = resolve(staticTarget);
    if (visualTarget) config.visualTarget = /^https?:\/\//i.test(visualTarget) || /^file:\/\//i.test(visualTarget) ? visualTarget : resolve(visualTarget);
    if (baseline) config.baseline = resolve(baseline);
    if (output) config.output = resolve(output);
    if (Number.isFinite(maxDifference)) config.maxDifference = maxDifference;
    const report = await runGate(config);
    process.stderr.write(`گزارش Guardian در ${config.output} ساخته شد.\n`);
    if (parsed.options.github === true) {
      githubAnnotations(report).forEach((annotation) => process.stdout.write(`${annotation}\n`));
      await writeGitHubSummary(report);
    }
    process.stdout.write(parsed.options.json ? `${JSON.stringify(report, null, 2)}\n` : gateMarkdown(report));
    if (parsed.options.strict && (report.summary.error > 0 || report.summary.warning > 0)) process.exitCode = 1;
    return;
  }
  throw new Error(`دستور ناشناخته است: ${parsed.command}\n\n${help()}`);
}

run().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
