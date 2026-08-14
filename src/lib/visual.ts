import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Page } from "playwright";
import type { Finding, Severity } from "../types.js";

export type VisualViewport = {
  width: number;
  height: number;
  name: string;
};

export type VisualViewportReport = {
  viewport: VisualViewport;
  screenshot: string;
  findings: Finding[];
  score: number;
};

export type VisualAuditReport = {
  target: string;
  outputDirectory: string;
  generatedAt: string;
  viewports: VisualViewportReport[];
  summary: Record<Severity, number>;
  score: number;
};

const defaultViewports: VisualViewport[] = [
  { width: 375, height: 812, name: "mobile-375" },
  { width: 768, height: 1024, name: "tablet-768" },
  { width: 1440, height: 1000, name: "desktop-1440" }
];

function summarize(findings: Finding[]): Record<Severity, number> {
  const summary: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  findings.forEach((item) => { summary[item.severity] += 1; });
  return summary;
}

function score(summary: Record<Severity, number>): number {
  return Math.max(0, 100 - summary.error * 25 - summary.warning * 7 - summary.info * 2);
}

function targetUrl(target: string): string {
  if (/^https?:\/\//i.test(target) || /^file:\/\//i.test(target)) return target;
  return pathToFileURL(resolve(target)).href;
}

function finding(id: string, severity: Severity, title: string, detail: string, fix: string): Finding {
  return { id, severity, title, detail, fix };
}

export function parseViewports(value?: string): VisualViewport[] {
  if (!value) return defaultViewports;
  const widths = [...new Set(value.split(",").map((item) => Number(item.trim())).filter((item) => Number.isInteger(item) && item >= 280 && item <= 3840))];
  if (!widths.length) throw new Error("مقدار viewport باید شامل عرض‌های معتبر مانند 375,768,1440 باشد.");
  return widths.map((width) => ({ width, height: width < 600 ? 812 : width < 1024 ? 1024 : 1000, name: `${width < 600 ? "mobile" : width < 1024 ? "tablet" : "desktop"}-${width}` }));
}

export function resolveVisualOutputDirectory(value?: string): string {
  return resolve(value || "parsiux-visual-report");
}

async function inspectPage(page: Page): Promise<Finding[]> {
  return page.evaluate(() => {
    type BrowserFinding = { id: string; severity: "error" | "warning" | "info"; title: string; detail: string; fix: string };
    const findings: BrowserFinding[] = [];
    const add = (id: string, severity: BrowserFinding["severity"], title: string, detail: string, fix: string) => {
      if (!findings.some((item) => item.id === id && item.detail === detail)) findings.push({ id, severity, title, detail, fix });
    };
    const visible = (element: Element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const ignored = (element: Element) => Boolean(element.closest("[data-parsiux-ignore]"));
    const rgb = (value: string): [number, number, number] | undefined => {
      const match = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
      if (!match || (match[4] !== undefined && Number(match[4]) === 0)) return undefined;
      return [Number(match[1]), Number(match[2]), Number(match[3])];
    };
    const luminance = ([red, green, blue]: [number, number, number]) => {
      const linear = [red, green, blue].map((value) => {
        const normalized = value / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const background = (element: Element): [number, number, number] | undefined => {
      let current: Element | null = element;
      while (current) {
        const parsed = rgb(window.getComputedStyle(current).backgroundColor);
        if (parsed) return parsed;
        current = current.parentElement;
      }
      return undefined;
    };
    const contrast = (foreground: [number, number, number], backgroundColor: [number, number, number]) => {
      const [light, dark] = [luminance(foreground), luminance(backgroundColor)].sort((left, right) => right - left);
      return (light + 0.05) / (dark + 0.05);
    };
    const html = document.documentElement;
    const htmlDirection = html.getAttribute("dir") || window.getComputedStyle(html).direction;
    const language = html.getAttribute("lang") || "";
    if (htmlDirection.toLowerCase() !== "rtl") add("visual-root-direction", "error", "جهت ریشه RTL نیست", "جهت واقعی سند در مرورگر RTL تشخیص داده نشد.", "روی تگ html از dir=\"rtl\" استفاده کن.");
    if (!/^fa(?:-|$)/i.test(language)) add("visual-root-language", "warning", "زبان فارسی مشخص نشده", "lang سند فارسی نیست.", "روی تگ html از lang=\"fa\" یا lang=\"fa-IR\" استفاده کن.");
    if (document.documentElement.scrollWidth > window.innerWidth + 4) {
      add("visual-horizontal-overflow", "error", "اسکرول افقی دیده شد", `عرض سند ${document.documentElement.scrollWidth}px و عرض viewport ${window.innerWidth}px است.`, "عنصر بیرون‌زده را با max-width، min-width منطقی و overflow مناسب اصلاح کن.");
      const overflowItems = [...document.querySelectorAll("body *")]
        .filter(visible)
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.left < -4 || rect.right > window.innerWidth + 4;
        })
        .slice(0, 4);
      overflowItems.forEach((element, index) => add(`visual-overflow-candidate-${index}`, "warning", "عنصر مشکوک به بیرون‌زدگی", `${element.tagName.toLowerCase()} با متن «${(element.textContent || "").trim().slice(0, 48)}» از viewport عبور کرده است.`, "عرض، margin، translate و محتوای بدون شکست این عنصر را در viewport فعلی بررسی کن."));
    }
    const bodyFont = window.getComputedStyle(document.body).fontFamily.toLowerCase();
    if (!/vazirmatn|estedad|shabnam|sahel|iransans|noto sans arabic/.test(bodyFont)) add("visual-persian-font", "warning", "فونت فارسی قابل تشخیص نیست", `font-family فعلی body: ${bodyFont || "نامشخص"}`, "یک فونت فارسی با وزن‌های واقعی و fallback مناسب روی body اعمال کن.");
    const interactive = [...document.querySelectorAll("a[href], button, input, select, textarea, [role=button], [tabindex]")].filter(visible).filter((element) => !ignored(element)).slice(0, 80) as HTMLElement[];
    if (!interactive.length) add("visual-no-interaction", "info", "تعامل قابل بررسی نیست", "هیچ عنصر interactive قابل مشاهده‌ای در صفحه پیدا نشد.", "اگر صفحه باید actionable باشد، تعامل‌های اصلی را در audit بعدی بررسی کن.");
    let focusFailures = 0;
    interactive.forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.width < 36 || rect.height < 36) add(`visual-touch-target-${focusFailures}-${rect.x}-${rect.y}`, "warning", "هدف لمسی کوچک است", `${element.tagName.toLowerCase()} با ابعاد ${Math.round(rect.width)}×${Math.round(rect.height)}px برای لمس ریسک دارد.`, "برای actionهای لمسی اصلی حداقل 44×44px در نظر بگیر.");
      const before = window.getComputedStyle(element);
      const signature = `${before.outlineStyle}|${before.outlineWidth}|${before.outlineColor}|${before.boxShadow}|${before.backgroundColor}|${before.borderColor}`;
      element.focus({ preventScroll: true });
      const after = window.getComputedStyle(element);
      const focused = `${after.outlineStyle}|${after.outlineWidth}|${after.outlineColor}|${after.boxShadow}|${after.backgroundColor}|${after.borderColor}`;
      if (signature === focused) focusFailures += 1;
    });
    if (interactive.length && focusFailures === interactive.length) add("visual-focus-style", "warning", "focus قابل مشاهده تشخیص داده نشد", "تغییر قابل مشاهده‌ای در style عنصرهای interactive پس از focus دیده نشد.", "برای :focus-visible outline یا ring با کنتراست مناسب تعریف کن.");
    const mixedCandidates = [...document.querySelectorAll("p, span, div, td, th, label, button, a")]
      .filter(visible)
      .filter((element) => !ignored(element))
      .map((element) => ({ element, text: (element.textContent || "").trim() }))
      .filter(({ text }) => /[\u0600-\u06FF]/.test(text) && /(?:https?:\/\/|www\.|\b\d{8,}\b|\b[A-Za-z]{2,}[/:._-][A-Za-z0-9/:._-]+)/.test(text))
      .slice(0, 5);
    mixedCandidates.forEach(({ element, text }, index) => {
      const direction = element.getAttribute("dir") || window.getComputedStyle(element).direction;
      const bidi = window.getComputedStyle(element).unicodeBidi;
      if (direction !== "ltr" && bidi === "normal") add(`visual-mixed-bidi-${index}`, "warning", "متن مختلط نیازمند بررسی bidi است", `متن فارسی همراه با شناسه، شماره یا URL پیدا شد: «${text.slice(0, 72)}»`, "بخش‌های LTR را با bdi، dir=ltr یا unicode-bidi:isolate از متن فارسی جدا کن.");
    });
    let lowContrast = 0;
    [...document.querySelectorAll("p, span, a, button, label, li, td, th, h1, h2, h3, h4, h5, h6")].filter(visible).filter((element) => !ignored(element)).forEach((element) => {
      if (lowContrast >= 4 || !(element.textContent || "").trim()) return;
      const style = window.getComputedStyle(element);
      const foreground = rgb(style.color);
      const backgroundColor = background(element);
      const fontSize = Number.parseFloat(style.fontSize);
      if (!foreground || !backgroundColor || Number.isNaN(fontSize)) return;
      if (contrast(foreground, backgroundColor) < (fontSize >= 24 ? 3 : 4.5)) {
        lowContrast += 1;
        add(`visual-low-contrast-${lowContrast}`, "warning", "کنتراست متن پایین است", `عنصر ${element.tagName.toLowerCase()} احتمالاً کنتراست کافی ندارد.`, "رنگ foreground یا background را طوری تغییر بده که نسبت کنتراست WCAG برقرار شود.");
      }
    });
    return findings;
  });
}

export async function visualAudit(target: string, options: { outputDirectory?: string; viewports?: VisualViewport[]; timeout?: number; fullPage?: boolean } = {}): Promise<VisualAuditReport> {
  const outputDirectory = resolveVisualOutputDirectory(options.outputDirectory);
  const viewports = options.viewports || defaultViewports;
  const timeout = Math.max(1_000, options.timeout || 15_000);
  const url = targetUrl(target);
  await mkdir(outputDirectory, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (/Executable doesn't exist|executable doesn't exist/i.test(detail)) throw new Error("Chromium برای Playwright نصب نیست. ابتدا این دستور را اجرا کن: npx playwright install chromium");
    if (/error while loading shared libraries|Missing libraries|Host system is missing dependencies/i.test(detail)) throw new Error("وابستگی‌های سیستم برای Chromium کامل نیستند. این دستور را اجرا کن: npx playwright install --with-deps chromium");
    throw error;
  }
  try {
    const reports: VisualViewportReport[] = [];
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, locale: "fa-IR", colorScheme: "light", deviceScaleFactor: 1 });
      try {
        const page = await context.newPage();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout });
        await page.waitForTimeout(250);
        const findings = await inspectPage(page);
        const screenshot = `${viewport.name}.png`;
        await page.screenshot({ path: join(outputDirectory, screenshot), fullPage: options.fullPage !== false });
        const summary = summarize(findings);
        reports.push({ viewport, screenshot, findings, score: score(summary) });
      } finally {
        await context.close();
      }
    }
    const allFindings = reports.flatMap((item) => item.findings);
    const report: VisualAuditReport = {
      target: url,
      outputDirectory,
      generatedAt: new Date().toISOString(),
      viewports: reports,
      summary: summarize(allFindings),
      score: Math.round(reports.reduce((total, item) => total + item.score, 0) / Math.max(reports.length, 1))
    };
    await writeFile(join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(join(outputDirectory, "report.fa.md"), visualMarkdown(report), "utf8");
    return report;
  } finally {
    await browser.close();
  }
}

export function visualMarkdown(report: VisualAuditReport): string {
  const viewports = report.viewports.map((item) => {
    const findings = item.findings.length
      ? item.findings.map((entry) => `- **${entry.severity.toUpperCase()} — ${entry.title}:** ${entry.detail}\n  - راه‌حل: ${entry.fix}`).join("\n")
      : "- ایراد شناخته‌شده‌ای پیدا نشد.";
    return `## ${item.viewport.name} — ${item.viewport.width}×${item.viewport.height}\n\n![${item.viewport.name}](${item.screenshot})\n\nامتیاز: **${item.score}/100**\n\n${findings}`;
  }).join("\n\n");
  return `# گزارش Visual RTL Audit\n\n- هدف: ${report.target}\n- زمان: ${report.generatedAt}\n- امتیاز میانگین: **${report.score}/100**\n- Error: ${report.summary.error} | Warning: ${report.summary.warning} | Info: ${report.summary.info}\n\n${viewports}\n\n---\n\nMade ❤️ by Mohammad — @llllxyz\n`;
}
