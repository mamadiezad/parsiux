import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { packageRoot } from "./paths.js";

const destinations: Record<string, string> = {
  claude: ".claude/skills/parsiux/SKILL.md",
  cursor: ".cursor/rules/parsiux.mdc",
  universal: ".agents/skills/parsiux/SKILL.md"
};

export async function installSkill(target: string, assistant: string): Promise<string[]> {
  const template = await readFile(join(packageRoot, "templates", "SKILL.md"), "utf8");
  const root = resolve(target);
  const assistants = assistant === "all" ? Object.keys(destinations) : [assistant];
  const written: string[] = [];
  for (const name of assistants) {
    const destination = destinations[name];
    if (!destination) throw new Error(`AI assistant پشتیبانی‌نشده است: ${name}`);
    const file = join(root, destination);
    await mkdir(resolve(file, ".."), { recursive: true });
    const content = name === "cursor" ? `---\ndescription: قواعد ParsiUX برای UI فارسی و RTL\n---\n\n${template}` : template;
    await writeFile(file, content, "utf8");
    written.push(file);
  }
  return written;
}
