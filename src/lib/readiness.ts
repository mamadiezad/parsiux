import { readdir, readFile, stat } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import type { Finding, Severity } from "../types.js";
import type { RuleProfile } from "./profiles.js";

const extensions = new Set([".html", ".htm", ".tsx", ".jsx", ".vue", ".svelte", ".mdx"]);
const ignoredDirectories = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", ".test-dist", "gallery"]);

type SourceFile = { absolute: string; relative: string; content: string };

export type ReadinessReport = {
  profile: string;
  target: string;
  scannedFiles: number;
  findings: Finding[];
  summary: Record<Severity, number>;
};

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

function summary(findings: Finding[]): Record<Severity, number> {
  const result: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  findings.forEach((item) => { result[item.severity] += 1; });
  return result;
}

function add(findings: Finding[], id: string, severity: Severity, title: string, detail: string, fix: string, file?: SourceFile, index?: number): void {
  if (findings.some((item) => item.id === id && item.file === file?.relative && item.line === (file && index !== undefined ? lineAt(file.content, index) : undefined))) return;
  findings.push({ id, severity, title, detail, fix, file: file?.relative, line: file && index !== undefined ? lineAt(file.content, index) : undefined });
}

function matches(content: string, expression: RegExp): number[] {
  const indexes: number[] = [];
  const flags = expression.flags.includes("g") ? expression.flags : `${expression.flags}g`;
  const matcher = new RegExp(expression.source, flags);
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(content)) !== null) {
    indexes.push(match.index);
    if (match.index === matcher.lastIndex) matcher.lastIndex += 1;
  }
  return indexes;
}

function active(profile: RuleProfile, check: string): boolean {
  return profile.checks.includes(check);
}

export async function readinessAudit(target: string, profile: RuleProfile): Promise<ReadinessReport> {
  const root = resolve(target);
  const files = await collectFiles(root);
  const findings: Finding[] = [];
  for (const file of files) {
    if (active(profile, "character-normalization")) {
      matches(file.content, /[يىكؤةۀ]/g).slice(0, 8).forEach((index) => add(findings, "persian-character-normalization", "warning", "کاراکتر عربی در متن فارسی", "یکی از شکل‌های عربی ی، ک، ة یا هم‌خانواده‌های آن پیدا شد.", "متن را با ی و ک فارسی نرمال‌سازی کن و نیم‌فاصله را آگاهانه نگه دار.", file, index));
    }
    if (active(profile, "money-spacing")) {
      matches(file.content, /[0-9۰-۹٠-٩][تت]ومان|[0-9۰-۹٠-٩]ریال/g).slice(0, 8).forEach((index) => add(findings, "persian-money-spacing", "warning", "فاصله مبلغ و واحد رعایت نشده", "عدد و تومان یا ریال بدون فاصله نوشته شده‌اند.", "بین مبلغ و واحد یک فاصله بگذار و بخش عدد را در متن مختلط bidi ایمن نگه دار.", file, index));
    }
    if (active(profile, "bidi-sensitive")) {
      matches(file.content, /(?:https?:\/\/\S+|\bIR\d{24}\b|\b\d{16}\b)/gi).slice(0, 8).forEach((index) => {
        const line = file.content.slice(file.content.lastIndexOf("\n", index) + 1, file.content.indexOf("\n", index) === -1 ? file.content.length : file.content.indexOf("\n", index));
        if (!/\bbdi\b|dir\s*=\s*["']ltr|unicode-bidi/i.test(line)) add(findings, "persian-sensitive-bidi", "warning", "داده‌ی حساس یا LTR بدون isolation", "URL، شماره‌ی بلند، شبا یا شناسه‌ای در متن پیدا شد که isolation صریح ندارد.", "بخش LTR را با bdi، dir=ltr یا unicode-bidi:isolate از متن فارسی جدا کن.", file, index);
      });
    }
    if (active(profile, "form-labels")) {
      matches(file.content, /<input\b[^>]*>/gi).slice(0, 12).forEach((index) => {
        const tagEnd = file.content.indexOf(">", index);
        const tag = file.content.slice(index, tagEnd === -1 ? file.content.length : tagEnd + 1);
        if (!/\bid\s*=|aria-label\s*=|aria-labelledby\s*=/i.test(tag)) add(findings, "persian-form-context", "warning", "فیلد بدون context قابل تشخیص", "یک input بدون id یا aria label پیدا شد.", "برای field یک label واقعی، id یا aria-label معنادار تعریف کن.", file, index);
      });
    }
    if (active(profile, "table-mobile")) {
      matches(file.content, /<table\b/gi).slice(0, 8).forEach((index) => add(findings, "persian-table-mobile", "info", "جدول نیازمند بازبینی موبایل است", "جدول در source پیدا شد و باید در 375px strategy مشخص داشته باشد.", "اسکرول افقی کنترل‌شده، اولویت‌بندی ستون‌ها یا تبدیل به card را در Visual Audit بررسی کن.", file, index));
    }
    if (active(profile, "commerce-copy")) {
      matches(file.content, /(?:افزودن|خرید|تخفیف|موجودی)/g).slice(0, 1).forEach((index) => add(findings, "commerce-copy-review", "info", "کپی فروشگاهی نیازمند بازبینی است", "متن مرتبط با خرید پیدا شد.", "هزینه نهایی، وضعیت موجودی و action اصلی را با متن روشن و نه فقط رنگ بررسی کن.", file, index));
    }
    if (active(profile, "sensitive-copy")) {
      matches(file.content, /(?:رمز|کد ملی|اطلاعات پزشکی|پرونده)/g).slice(0, 3).forEach((index) => add(findings, "sensitive-copy-review", "info", "متن حساس نیازمند بازبینی است", "یک مفهوم حساس در رابط پیدا شد.", "دلیل درخواست داده، حریم خصوصی، masking و مسیر کمک را برای این بخش بررسی کن.", file, index));
    }
  }
  return { profile: profile.id, target: root, scannedFiles: files.length, findings, summary: summary(findings) };
}

export function readinessMarkdown(report: ReadinessReport): string {
  const body = report.findings.length ? report.findings.map((item) => `### ${item.severity.toUpperCase()} — ${item.title}\n\n${item.file ? `- فایل: ${item.file}${item.line ? `:${item.line}` : ""}\n` : ""}- مسئله: ${item.detail}\n- راه‌حل: ${item.fix}`).join("\n\n") : "ایراد قابل تشخیصی در ruleهای فعال پیدا نشد.";
  return `# Persian Readiness Report\n\n- Profile: ${report.profile}\n- مسیر: ${report.target}\n- فایل بررسی‌شده: ${report.scannedFiles}\n- Error: ${report.summary.error} | Warning: ${report.summary.warning} | Info: ${report.summary.info}\n\n${body}\n`;
}
