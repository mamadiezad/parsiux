import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { packageRoot } from "./paths.js";

export type RuleProfile = {
  id: string;
  title: string;
  description: string;
  checks: string[];
};

type ProfileCatalog = {
  version: string;
  profiles: RuleProfile[];
};

let cachedCatalog: ProfileCatalog | undefined;

async function loadProfileCatalog(): Promise<ProfileCatalog> {
  if (cachedCatalog) return cachedCatalog;
  const raw = await readFile(join(packageRoot, "data", "profiles.fa.json"), "utf8");
  cachedCatalog = JSON.parse(raw) as ProfileCatalog;
  return cachedCatalog;
}

export async function listProfiles(): Promise<RuleProfile[]> {
  return (await loadProfileCatalog()).profiles;
}

export async function getProfile(id = "base-fa"): Promise<RuleProfile> {
  const profile = (await listProfiles()).find((item) => item.id === id);
  if (!profile) throw new Error(`پروفایل ناشناخته است: ${id}`);
  return profile;
}

export function profilesMarkdown(profiles: RuleProfile[]): string {
  return `# Rule Packهای ParsiUX\n\n${profiles.map((profile) => `## ${profile.title}\n\n- شناسه: \`${profile.id}\`\n- ${profile.description}\n- کنترل‌ها: ${profile.checks.map((item) => `\`${item}\``).join("، ")}`).join("\n\n")}\n`;
}
