import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { type VisualAuditReport, type VisualViewport, visualAudit } from "./visual.js";
import type { Severity } from "../types.js";

export type RegressionSnapshot = {
  viewport: VisualViewport;
  baseline: string;
  current: string;
  diff?: string;
  changedPixels: number;
  totalPixels: number;
  differenceRatio: number;
  severity: Severity;
  detail: string;
};

export type RegressionReport = {
  target: string;
  baselineDirectory: string;
  outputDirectory: string;
  generatedAt: string;
  maxDifference: number;
  visualReport: VisualAuditReport;
  snapshots: RegressionSnapshot[];
  summary: Record<Severity, number>;
  pass: boolean;
};

function summarize(snapshots: RegressionSnapshot[]): Record<Severity, number> {
  const summary: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  snapshots.forEach((snapshot) => { summary[snapshot.severity] += 1; });
  return summary;
}

function viewportList(report: VisualAuditReport): VisualViewport[] {
  return report.viewports.map((item) => item.viewport);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function relativePath(value: string): string {
  return value.replaceAll("\\", "/");
}

export function baselineSlug(name: string): string {
  const normalized = name.normalize("NFKC").trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  if (!normalized) throw new Error("نام baseline باید شامل حرف یا عدد باشد.");
  return normalized;
}

export async function createBaseline(target: string, name: string, options: { outputDirectory?: string; force?: boolean; viewports?: VisualViewport[]; timeout?: number } = {}): Promise<{ directory: string; report: VisualAuditReport }> {
  const directory = join(resolve(options.outputDirectory || ".parsiux/baselines"), baselineSlug(name));
  if (await exists(directory)) {
    if (!options.force) throw new Error(`baseline با نام «${name}» وجود دارد. برای جایگزینی از --force استفاده کن.`);
    await rm(directory, { recursive: true, force: true });
  }
  await mkdir(directory, { recursive: true });
  const report = await visualAudit(target, { outputDirectory: directory, viewports: options.viewports, timeout: options.timeout });
  const manifest = {
    name: baselineSlug(name),
    createdAt: new Date().toISOString(),
    reportFile: "report.json",
    target: report.target,
    viewports: viewportList(report)
  };
  await writeFile(join(directory, "baseline.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { directory, report };
}

async function readVisualReport(directory: string): Promise<VisualAuditReport> {
  const path = join(directory, "report.json");
  if (!await exists(path)) throw new Error(`فایل report.json در baseline پیدا نشد: ${directory}`);
  return JSON.parse(await readFile(path, "utf8")) as VisualAuditReport;
}

export async function compareBaseline(target: string, baselineDirectory: string, options: { outputDirectory?: string; maxDifference?: number; timeout?: number } = {}): Promise<RegressionReport> {
  const baselineRoot = resolve(baselineDirectory);
  const baselineReport = await readVisualReport(baselineRoot);
  const outputDirectory = resolve(options.outputDirectory || "parsiux-regression-report");
  const currentDirectory = join(outputDirectory, "current");
  const diffDirectory = join(outputDirectory, "diff");
  await rm(currentDirectory, { recursive: true, force: true });
  await rm(diffDirectory, { recursive: true, force: true });
  await mkdir(diffDirectory, { recursive: true });
  const maxDifference = options.maxDifference === undefined ? 0.01 : options.maxDifference;
  if (!Number.isFinite(maxDifference) || maxDifference < 0 || maxDifference > 1) throw new Error("max-diff باید عددی بین 0 و 1 باشد.");
  const visualReport = await visualAudit(target, { outputDirectory: currentDirectory, viewports: viewportList(baselineReport), timeout: options.timeout });
  const snapshots: RegressionSnapshot[] = [];
  for (const baselineViewport of baselineReport.viewports) {
    const currentViewport = visualReport.viewports.find((item) => item.viewport.name === baselineViewport.viewport.name);
    const baseline = join(baselineRoot, baselineViewport.screenshot);
    const current = currentViewport ? join(currentDirectory, currentViewport.screenshot) : "";
    if (!currentViewport || !await exists(baseline) || !await exists(current)) {
      snapshots.push({ viewport: baselineViewport.viewport, baseline: relativePath(baseline), current: relativePath(current), changedPixels: 0, totalPixels: 0, differenceRatio: 1, severity: "error", detail: "screenshot baseline یا screenshot فعلی برای این viewport پیدا نشد." });
      continue;
    }
    const baselineImage = PNG.sync.read(await readFile(baseline));
    const currentImage = PNG.sync.read(await readFile(current));
    if (baselineImage.width !== currentImage.width || baselineImage.height !== currentImage.height) {
      snapshots.push({ viewport: baselineViewport.viewport, baseline: relativePath(baseline), current: relativePath(current), changedPixels: 0, totalPixels: Math.max(baselineImage.width * baselineImage.height, currentImage.width * currentImage.height), differenceRatio: 1, severity: "error", detail: `ابعاد screenshot تغییر کرده است: baseline ${baselineImage.width}×${baselineImage.height} و current ${currentImage.width}×${currentImage.height}.` });
      continue;
    }
    const diff = new PNG({ width: baselineImage.width, height: baselineImage.height });
    const changedPixels = pixelmatch(baselineImage.data, currentImage.data, diff.data, baselineImage.width, baselineImage.height, { threshold: 0.1, includeAA: false });
    const totalPixels = baselineImage.width * baselineImage.height;
    const differenceRatio = changedPixels / totalPixels;
    const diffName = `${baselineViewport.viewport.name}.png`;
    await writeFile(join(diffDirectory, diffName), PNG.sync.write(diff));
    snapshots.push({
      viewport: baselineViewport.viewport,
      baseline: relativePath(baseline),
      current: relativePath(current),
      diff: relativePath(join(diffDirectory, diffName)),
      changedPixels,
      totalPixels,
      differenceRatio,
      severity: differenceRatio > maxDifference ? "error" : differenceRatio > 0 ? "warning" : "info",
      detail: differenceRatio > maxDifference ? `تغییر تصویر ${(differenceRatio * 100).toFixed(3)}% از حد مجاز ${(maxDifference * 100).toFixed(3)}% بیشتر است.` : differenceRatio > 0 ? `تغییر تصویر ${(differenceRatio * 100).toFixed(3)}% در محدوده مجاز است.` : "تصویر بدون تغییر است."
    });
  }
  const summary = summarize(snapshots);
  const report: RegressionReport = {
    target,
    baselineDirectory: baselineRoot,
    outputDirectory,
    generatedAt: new Date().toISOString(),
    maxDifference,
    visualReport,
    snapshots,
    summary,
    pass: summary.error === 0
  };
  await writeFile(join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(join(outputDirectory, "report.fa.md"), regressionMarkdown(report), "utf8");
  return report;
}

export function regressionMarkdown(report: RegressionReport): string {
  const entries = report.snapshots.map((snapshot) => {
    const current = snapshot.current ? `![current](${relativePath(join("current", snapshot.viewport.name + ".png"))})` : "screenshot فعلی موجود نیست.";
    const diff = snapshot.diff ? `![diff](${relativePath(join("diff", snapshot.viewport.name + ".png"))})` : "diff قابل ساخت نیست.";
    return `## ${snapshot.viewport.name} — ${snapshot.viewport.width}×${snapshot.viewport.height}\n\n- وضعیت: **${snapshot.severity.toUpperCase()}**\n- تغییر: **${(snapshot.differenceRatio * 100).toFixed(3)}%** (${snapshot.changedPixels.toLocaleString("en-US")} / ${snapshot.totalPixels.toLocaleString("en-US")} pixel)\n- جزئیات: ${snapshot.detail}\n\n### تصویر فعلی\n\n${current}\n\n### Diff\n\n${diff}`;
  }).join("\n\n");
  return `# گزارش Visual Regression\n\n- هدف: ${report.target}\n- baseline: ${report.baselineDirectory}\n- زمان: ${report.generatedAt}\n- حد تغییر مجاز: ${(report.maxDifference * 100).toFixed(3)}%\n- نتیجه: **${report.pass ? "PASS" : "FAIL"}**\n- Error: ${report.summary.error} | Warning: ${report.summary.warning} | Info: ${report.summary.info}\n\n${entries}\n\n---\n\nMade ❤️ by Mohammad — @llllxyz\n`;
}
