import { readdir, readFile, stat } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";
import type { AuditReport, Finding, Severity } from "../types.js";

const extensions = new Set([".html", ".htm", ".css", ".scss", ".sass", ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".mdx"]);
const ignored = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage"]);

type SourceFile = { absolute: string; relative: string; content: string };

async function collectFiles(root: string, current = root, files: SourceFile[] = []): Promise<SourceFile[]> {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (files.length >= 1200) break;
    const absolute = resolve(current, entry.name);
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) await collectFiles(root, absolute, files);
      continue;
    }
    if (!extensions.has(extname(entry.name).toLowerCase())) continue;
    const info = await stat(absolute);
    if (info.size > 1_000_000) continue;
    files.push({ absolute, relative: relative(root, absolute), content: await readFile(absolute, "utf8") });
  }
  return files;
}

function lineAt(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function occurrences(file: SourceFile, expression: RegExp): number[] {
  const indexes: number[] = [];
  const flags = expression.flags.includes("g") ? expression.flags : `${expression.flags}g`;
  const matcher = new RegExp(expression.source, flags);
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(file.content)) !== null) {
    indexes.push(match.index);
    if (match.index === matcher.lastIndex) matcher.lastIndex += 1;
  }
  return indexes;
}

function finding(id: string, severity: Severity, title: string, detail: string, fix: string, file?: SourceFile, index?: number): Finding {
  return { id, severity, title, detail, fix, file: file?.relative, line: index === undefined || !file ? undefined : lineAt(file.content, index) };
}

function sourceHas(files: SourceFile[], expression: RegExp): boolean {
  return files.some((file) => expression.test(file.content));
}

export async function auditPath(target: string): Promise<AuditReport> {
  const root = resolve(target);
  const files = await collectFiles(root);
  const findings: Finding[] = [];
  const markup = files.filter((file) => /\.(html?|tsx?|jsx?|vue|svelte|mdx)$/i.test(file.relative));
  const styles = files.filter((file) => /\.(css|scss|sass|html?|tsx?|jsx?|vue|svelte|mdx)$/i.test(file.relative));
  const hasRtl = sourceHas(markup, /\bdir\s*=\s*["'{]rtl/i) || sourceHas(styles, /\bdirection\s*:\s*rtl\b/i);
  const hasLang = sourceHas(markup, /\blang\s*=\s*["'{]fa(?:-IR)?/i);
  const hasViewport = sourceHas(markup, /name\s*=\s*["']viewport["']/i);
  const hasPersianFont = sourceHas(styles, /Vazirmatn|Estedad|Shabnam|Sahel|Noto Sans Arabic|IRANSans/i);

  if (!files.length) findings.push(finding("empty-target", "error", "فایل قابل بررسی پیدا نشد", "مسیر انتخاب‌شده فاقد فایل رابط پشتیبانی‌شده است.", "مسیر ریشه‌ی پروژه را به audit بدهید."));
  if (!hasRtl) findings.push(finding("missing-rtl", "error", "جهت RTL تعریف نشده", "هیچ dir=rtl یا direction:rtl در فایل‌های رابط پیدا نشد.", "روی html مقدار lang=fa و dir=rtl بگذارید."));
  if (!hasLang) findings.push(finding("missing-lang", "warning", "زبان فارسی مشخص نشده", "lang=fa یا lang=fa-IR پیدا نشد.", "روی تگ html از lang=fa استفاده کنید."));
  if (!hasViewport && markup.length) findings.push(finding("missing-viewport", "warning", "Viewport موبایل مشخص نشده", "meta viewport پیدا نشد.", "meta viewport استاندارد را به head اضافه کنید."));
  if (!hasPersianFont) findings.push(finding("missing-persian-font", "warning", "فونت فارسی قابل تشخیص نیست", "هیچ فونت فارسی شناخته‌شده‌ای در source پیدا نشد.", "یک فونت فارسی با وزن‌های واقعی و fallback مناسب تعریف کنید."));

  for (const file of styles) {
    for (const index of occurrences(file, /\b(?:margin|padding|border|inset)-(?:left|right)\s*:/gi)) {
      findings.push(finding("physical-css", "warning", "ویژگی فیزیکی CSS", "استفاده از left/right در layout RTL را شکننده می‌کند.", "از margin-inline، padding-inline، border-inline و inset-inline استفاده کنید.", file, index));
    }
    for (const index of occurrences(file, /\b(?:left|right)\s*:/gi)) {
      findings.push(finding("physical-position", "warning", "موقعیت‌دهی فیزیکی", "left/right ممکن است در حالت RTL رفتار نادرست داشته باشد.", "از inset-inline-start یا inset-inline-end استفاده کنید.", file, index));
    }
    for (const index of occurrences(file, /text-align\s*:\s*(?:left|right)/gi)) {
      findings.push(finding("physical-text-align", "warning", "تراز فیزیکی متن", "تراز متن به جهت سند وابسته نشده است.", "از text-align:start یا text-align:end استفاده کنید.", file, index));
    }
    for (const index of occurrences(file, /\b(?:float\s*:\s*(?:left|right)|float-(?:left|right))\b/gi)) {
      findings.push(finding("physical-float", "warning", "Float فیزیکی", "float چپ یا راست در رابط RTL قابل اتکا نیست.", "از Flexbox یا Grid با propertyهای منطقی استفاده کنید.", file, index));
    }
    for (const index of occurrences(file, /\b(?:m|p)(?:l|r)-\S+|\b(?:left|right)-\S+|\btext-(?:left|right)\b/g)) {
      findings.push(finding("physical-tailwind", "warning", "کلاس فیزیکی Tailwind", "کلاس‌های ml/mr/pl/pr/left/right/text-left برای RTL شکننده‌اند.", "از ms/me/ps/pe/start/end/text-start یا variant RTL استفاده کنید.", file, index));
    }
    for (const index of occurrences(file, /overflow\s*:\s*hidden/gi)) {
      findings.push(finding("overflow-hidden", "info", "بررسی overflow لازم است", "overflow:hidden ممکن است متن فارسی بلند یا focus را پنهان کند.", "در عرض 375 پیکسل، zoom و keyboard navigation این بخش را بررسی کنید.", file, index));
    }
  }

  const summary: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  findings.forEach((item) => { summary[item.severity] += 1; });
  const score = Math.max(0, 100 - summary.error * 30 - summary.warning * 6 - summary.info * 2);
  return { target: root, scannedFiles: files.length, score, findings, summary };
}

export function auditMarkdown(report: AuditReport): string {
  const header = `# گزارش ParsiUX RTL Audit\n\n- مسیر: ${report.target}\n- فایل بررسی‌شده: ${report.scannedFiles}\n- امتیاز: ${report.score}/100\n- Error: ${report.summary.error} | Warning: ${report.summary.warning} | Info: ${report.summary.info}\n`;
  if (!report.findings.length) return `${header}\n## نتیجه\n\nهیچ ایراد شناخته‌شده‌ای پیدا نشد. بازبینی تصویری در viewportهای واقعی همچنان ضروری است.\n`;
  return `${header}\n## یافته‌ها\n\n${report.findings.map((item) => `### ${item.severity.toUpperCase()} — ${item.title}\n\n${item.file ? `- فایل: ${item.file}${item.line ? `:${item.line}` : ""}\n` : ""}- مسئله: ${item.detail}\n- راه‌حل: ${item.fix}`).join("\n\n")}\n`;
}
