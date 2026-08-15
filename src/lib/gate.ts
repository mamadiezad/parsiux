import { appendFile, mkdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { auditMarkdown, auditPath } from "./audit.js";
import type { GuardianConfig } from "./guardian-config.js";
import { getProfile, type RuleProfile } from "./profiles.js";
import { readinessAudit, readinessMarkdown, type ReadinessReport } from "./readiness.js";
import { compareBaseline, regressionMarkdown, type RegressionReport } from "./regression.js";
import { visualAudit, visualMarkdown, type VisualAuditReport } from "./visual.js";
import type { AuditReport, Finding, Severity } from "../types.js";

export type GateReport = {
  profile: RuleProfile;
  config: GuardianConfig;
  generatedAt: string;
  staticReport: AuditReport;
  readinessReport: ReadinessReport;
  visualReport: VisualAuditReport;
  regressionReport?: RegressionReport;
  findings: Finding[];
  summary: Record<Severity, number>;
  score: number;
  pass: boolean;
};

function summarize(findings: Finding[]): Record<Severity, number> {
  const summary: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  findings.forEach((item) => { summary[item.severity] += 1; });
  return summary;
}

function visualFindings(report: VisualAuditReport): Finding[] {
  return report.viewports.flatMap((viewport) => viewport.findings.map((item) => ({ ...item, id: `${item.id}-${viewport.viewport.name}`, detail: `${item.detail} (${viewport.viewport.width}×${viewport.viewport.height})` })));
}

function regressionFindings(report: RegressionReport): Finding[] {
  return report.snapshots.map((snapshot) => ({
    id: `visual-regression-${snapshot.viewport.name}`,
    severity: snapshot.severity,
    title: "Visual Regression",
    detail: `${snapshot.viewport.name}: ${snapshot.detail}`,
    fix: "تصویر current و diff را بازبینی کن؛ در صورت تأیید آگاهانه‌ی تغییر، baseline را با review به‌روزرسانی کن."
  }));
}

async function visualTarget(value: string): Promise<string> {
  if (/^https?:\/\//i.test(value) || /^file:\/\//i.test(value)) return value;
  const target = resolve(value);
  const details = await stat(target);
  if (!details.isDirectory()) return target;
  for (const candidate of ["index.html", "public/index.html", "gallery/index.html"]) {
    try {
      const file = join(target, candidate);
      if ((await stat(file)).isFile()) return file;
    } catch {
      continue;
    }
  }
  throw new Error("visualTarget یک پوشه بدون index.html است. URL dev server یا مسیر فایل HTML را در config وارد کن.");
}

export async function runGate(config: GuardianConfig): Promise<GateReport> {
  const profile = await getProfile(config.profile);
  const output = resolve(config.output);
  await mkdir(output, { recursive: true });
  const staticReport = await auditPath(config.staticTarget);
  const readinessReport = await readinessAudit(config.staticTarget, profile);
  const target = await visualTarget(config.visualTarget);
  const regressionReport = config.baseline ? await compareBaseline(target, config.baseline, { outputDirectory: join(output, "regression"), maxDifference: config.maxDifference }) : undefined;
  const visualReport = regressionReport?.visualReport || await visualAudit(target, { outputDirectory: join(output, "visual") });
  const findings = [
    ...staticReport.findings,
    ...readinessReport.findings,
    ...visualFindings(visualReport),
    ...(regressionReport ? regressionFindings(regressionReport) : [])
  ];
  const summary = summarize(findings);
  const scores = [staticReport.score, visualReport.score, Math.max(0, 100 - readinessReport.summary.error * 25 - readinessReport.summary.warning * 7 - readinessReport.summary.info * 2)];
  if (regressionReport) scores.push(regressionReport.pass ? 100 : 0);
  const report: GateReport = {
    profile,
    config,
    generatedAt: new Date().toISOString(),
    staticReport,
    readinessReport,
    visualReport,
    regressionReport,
    findings,
    summary,
    score: Math.round(scores.reduce((total, item) => total + item, 0) / scores.length),
    pass: summary.error === 0
  };
  await writeFile(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(join(output, "report.fa.md"), gateMarkdown(report), "utf8");
  return report;
}

export function gateMarkdown(report: GateReport): string {
  const findings = report.findings.length ? report.findings.map((item) => `- **${item.severity.toUpperCase()} — ${item.title}:** ${item.detail}${item.file ? ` (${item.file}${item.line ? `:${item.line}` : ""})` : ""}\n  - راه‌حل: ${item.fix}`).join("\n") : "- ایراد شناخته‌شده‌ای پیدا نشد.";
  return `# ParsiUX Guardian Report\n\n- Profile: ${report.profile.title} (\`${report.profile.id}\`)\n- زمان: ${report.generatedAt}\n- امتیاز: **${report.score}/100**\n- نتیجه: **${report.pass ? "PASS" : "FAIL"}**\n- Error: ${report.summary.error} | Warning: ${report.summary.warning} | Info: ${report.summary.info}\n\n## یافته‌های تجمیع‌شده\n\n${findings}\n\n## Static RTL Audit\n\n${auditMarkdown(report.staticReport)}\n\n## Persian Readiness\n\n${readinessMarkdown(report.readinessReport)}\n\n## Visual RTL Audit\n\n${visualMarkdown(report.visualReport)}${report.regressionReport ? `\n\n## Visual Regression\n\n${regressionMarkdown(report.regressionReport)}` : ""}\n`;
}

function escapeWorkflowValue(value: string): string {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

export async function writeGitHubSummary(report: GateReport): Promise<void> {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (path) await appendFile(path, `${gateMarkdown(report)}\n`, "utf8");
}

export function githubAnnotations(report: GateReport): string[] {
  return report.findings.filter((item) => item.severity === "error" || item.severity === "warning").map((item) => {
    const attributes = [
      `title=ParsiUX Guardian: ${escapeWorkflowValue(item.title)}`,
      ...(item.file ? [`file=${escapeWorkflowValue(item.file)}`] : []),
      ...(item.line ? [`line=${item.line}`] : [])
    ].join(",");
    return `::${item.severity} ${attributes}::${escapeWorkflowValue(`${item.detail} راه‌حل: ${item.fix}`)}`;
  });
}
