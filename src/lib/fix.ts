import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

const extensions = new Set([".css", ".scss", ".sass", ".html", ".htm", ".tsx", ".jsx", ".vue", ".svelte"]);
const ignoredDirectories = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".test-dist", "gallery"]);

type SourceFile = { absolute: string; relative: string; content: string };

export type FixChange = {
  file: string;
  line: number;
  rule: string;
  before: string;
  after: string;
};

export type FixReport = {
  target: string;
  applied: boolean;
  scannedFiles: number;
  changedFiles: number;
  changes: FixChange[];
};

const replacements: Array<{ rule: string; expression: RegExp; value: string }> = [
  { rule: "margin-left → margin-inline-start", expression: /\bmargin-left\b/g, value: "margin-inline-start" },
  { rule: "margin-right → margin-inline-end", expression: /\bmargin-right\b/g, value: "margin-inline-end" },
  { rule: "padding-left → padding-inline-start", expression: /\bpadding-left\b/g, value: "padding-inline-start" },
  { rule: "padding-right → padding-inline-end", expression: /\bpadding-right\b/g, value: "padding-inline-end" },
  { rule: "border-left → border-inline-start", expression: /\bborder-left\b/g, value: "border-inline-start" },
  { rule: "border-right → border-inline-end", expression: /\bborder-right\b/g, value: "border-inline-end" },
  { rule: "text-align:left → text-align:start", expression: /text-align\s*:\s*left\b/g, value: "text-align: start" },
  { rule: "text-align:right → text-align:end", expression: /text-align\s*:\s*right\b/g, value: "text-align: end" },
  { rule: "ml-* → ms-*", expression: /\bml-([\w\[\]-]+)/g, value: "ms-$1" },
  { rule: "mr-* → me-*", expression: /\bmr-([\w\[\]-]+)/g, value: "me-$1" },
  { rule: "pl-* → ps-*", expression: /\bpl-([\w\[\]-]+)/g, value: "ps-$1" },
  { rule: "pr-* → pe-*", expression: /\bpr-([\w\[\]-]+)/g, value: "pe-$1" },
  { rule: "text-left → text-start", expression: /\btext-left\b/g, value: "text-start" },
  { rule: "text-right → text-end", expression: /\btext-right\b/g, value: "text-end" }
];

async function collectFiles(root: string, current = root, files: SourceFile[] = []): Promise<SourceFile[]> {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (files.length >= 1200) break;
    const absolute = resolve(current, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) await collectFiles(root, absolute, files);
      continue;
    }
    if (!extensions.has(extname(entry.name).toLowerCase())) continue;
    if ((await stat(absolute)).size > 1_000_000) continue;
    files.push({ absolute, relative: relative(root, absolute), content: await readFile(absolute, "utf8") });
  }
  return files;
}

function lineAt(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

export async function safeRtlFix(target: string, apply = false): Promise<FixReport> {
  const root = resolve(target);
  const files = await collectFiles(root);
  const changes: FixChange[] = [];
  let changedFiles = 0;
  for (const file of files) {
    let transformed = file.content;
    for (const replacement of replacements) {
      transformed = transformed.replace(replacement.expression, (...args: unknown[]) => {
        const matched = String(args[0]);
        const index = Number(args[args.length - 2]);
        const after = matched.replace(replacement.expression, replacement.value);
        changes.push({ file: file.relative, line: lineAt(file.content, index), rule: replacement.rule, before: matched, after });
        return after;
      });
    }
    if (transformed !== file.content) {
      changedFiles += 1;
      if (apply) await writeFile(file.absolute, transformed, "utf8");
    }
  }
  return { target: root, applied: apply, scannedFiles: files.length, changedFiles, changes };
}

export function fixMarkdown(report: FixReport): string {
  const changes = report.changes.length ? report.changes.map((item) => `- ${item.file}:${item.line} · ${item.rule} · \`${item.before}\` → \`${item.after}\``).join("\n") : "- تغییر امنی پیدا نشد.";
  return `# ParsiUX Safe RTL Fix\n\n- مسیر: ${report.target}\n- حالت: ${report.applied ? "تغییرها اعمال شدند" : "dry-run"}\n- فایل بررسی‌شده: ${report.scannedFiles}\n- فایل قابل تغییر: ${report.changedFiles}\n- تعداد اصلاح: ${report.changes.length}\n\n${changes}\n`;
}
