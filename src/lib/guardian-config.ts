import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export type GuardianConfig = {
  profile: string;
  staticTarget: string;
  visualTarget: string;
  baseline?: string;
  output: string;
  maxDifference: number;
};

type GuardianConfigInput = Partial<GuardianConfig>;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function resolveTarget(root: string, value: string): string {
  return /^https?:\/\//i.test(value) || /^file:\/\//i.test(value) ? value : resolve(root, value);
}

export async function loadGuardianConfig(path?: string): Promise<{ config: GuardianConfig; path?: string }> {
  if (!path) return { config: { profile: "base-fa", staticTarget: process.cwd(), visualTarget: process.cwd(), output: resolve("parsiux-gate-report"), maxDifference: 0.01 } };
  const configPath = resolve(path);
  if (!await exists(configPath)) throw new Error(`فایل config پیدا نشد: ${configPath}`);
  const raw = JSON.parse(await readFile(configPath, "utf8")) as GuardianConfigInput;
  const root = dirname(configPath);
  const maxDifference = raw.maxDifference ?? 0.01;
  if (!Number.isFinite(maxDifference) || maxDifference < 0 || maxDifference > 1) throw new Error("maxDifference باید عددی بین 0 و 1 باشد.");
  return {
    path: configPath,
    config: {
      profile: raw.profile || "base-fa",
      staticTarget: resolveTarget(root, raw.staticTarget || "."),
      visualTarget: resolveTarget(root, raw.visualTarget || raw.staticTarget || "."),
      baseline: raw.baseline ? resolveTarget(root, raw.baseline) : undefined,
      output: resolveTarget(root, raw.output || "parsiux-gate-report"),
      maxDifference
    }
  };
}

export async function createGuardianSetup(target: string, options: { force?: boolean } = {}): Promise<{ config: string; workflow: string }> {
  const root = resolve(target);
  const config = join(root, "parsiux.config.json");
  const workflow = join(root, ".github", "workflows", "parsiux-guardian.yml");
  if (!options.force && (await exists(config) || await exists(workflow))) throw new Error("parsiux.config.json یا workflow از قبل وجود دارد. برای جایگزینی از --force استفاده کن.");
  await mkdir(dirname(workflow), { recursive: true });
  const configContent = {
    profile: "base-fa",
    staticTarget: ".",
    visualTarget: "http://localhost:3000",
    baseline: ".parsiux/baselines/homepage",
    output: "parsiux-gate-report",
    maxDifference: 0.01
  };
  const workflowContent = `name: ParsiUX Guardian\n\non:\n  pull_request:\n  push:\n    branches: [main]\n\npermissions:\n  contents: read\n\njobs:\n  guardian:\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n          cache: npm\n      - run: npm ci\n      - run: npm run dev -- --host 0.0.0.0 > /tmp/parsiux-app.log 2>&1 &\n      - run: |\n          for i in {1..60}; do\n            if curl -fsS http://127.0.0.1:3000 > /dev/null; then exit 0; fi\n            sleep 1\n          done\n          cat /tmp/parsiux-app.log\n          exit 1\n      - run: git clone --depth 1 https://github.com/mamadiezad/parsiux.git /tmp/parsiux\n      - run: cd /tmp/parsiux && npm ci && npm run build && npx playwright install chromium\n      - run: node /tmp/parsiux/dist/src/cli.js gate --config parsiux.config.json --github --strict\n      - uses: actions/upload-artifact@v4\n        if: always()\n        with:\n          name: parsiux-guardian-report\n          path: parsiux-gate-report/\n          if-no-files-found: ignore\n          retention-days: 14\n`;
  await writeFile(config, `${JSON.stringify(configContent, null, 2)}\n`, "utf8");
  await writeFile(workflow, workflowContent, "utf8");
  return { config, workflow };
}
