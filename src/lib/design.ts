import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadCatalog } from "./catalog.js";
import { searchProducts } from "./search.js";
import type { Product } from "../types.js";

export type DesignResult = {
  name: string;
  prompt: string;
  stack: string;
  score: number;
  product: Product;
  tokens: Record<string, unknown>;
  checklist: string[];
};

function slugify(value: string): string {
  const latin = value
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return latin || "parsiux-project";
}

function defaultProduct(): Product {
  return {
    id: "general-rtl",
    title: "محصول فارسی عمومی",
    keywords: ["فارسی", "rtl", "محصول"],
    summary: "رابطی واضح، راست‌چین و قابل توسعه برای محصول‌های فارسی‌زبان.",
    goal: "فهم سریع و انجام کار اصلی بدون اصطکاک",
    sections: ["هدر", "ارزش اصلی", "محتوای کلیدی", "اعتمادسازی", "اقدام نهایی"],
    components: ["دکمه", "فیلد فرم", "کارت", "اعلان", "حالت خالی"],
    style: "مینیمال، محتوایی و قابل اعتماد",
    colors: { primary: "#155EEF", surface: "#FFFFFF", background: "#F8FAFC", text: "#101828", muted: "#475467", success: "#039855", danger: "#D92D20" },
    font: { family: "Vazirmatn", fallback: "Tahoma, sans-serif", headingWeight: 700, bodyWeight: 400, lineHeight: 1.9 },
    copyRules: ["جمله‌ها کوتاه و فعل‌محور باشند", "برای عدد و واحد از فاصله‌ی درست استفاده شود"],
    antiPatterns: ["استفاده‌ی تزئینی از خط نستعلیق در متن رابط", "وابسته کردن معنی فقط به رنگ"],
    auditHints: ["dir=rtl", "logical CSS", "تست متن مختلط"]
  };
}

export async function createDesign(prompt: string, stack = "nextjs", name?: string): Promise<DesignResult> {
  const catalog = await loadCatalog();
  const hit = searchProducts(catalog.products, prompt, 1)[0];
  const product = hit?.product ?? defaultProduct();
  const projectName = name?.trim() || product.title;
  const tokens = {
    meta: { locale: "fa-IR", direction: "rtl", stack },
    color: product.colors,
    font: {
      family: product.font.family,
      fallback: product.font.fallback,
      headingWeight: product.font.headingWeight,
      bodyWeight: product.font.bodyWeight,
      lineHeight: product.font.lineHeight
    },
    spacing: { "1": "0.25rem", "2": "0.5rem", "3": "0.75rem", "4": "1rem", "6": "1.5rem", "8": "2rem", "12": "3rem", "16": "4rem" },
    radius: { control: "0.75rem", card: "1rem", modal: "1.25rem" },
    layout: { contentMax: "72rem", touchTarget: "2.75rem", direction: "rtl" }
  };
  const checklist = [
    "تگ html دارای lang=fa و dir=rtl است.",
    "در CSS فقط از margin-inline، padding-inline، inset-inline و text-align:start/end استفاده شده است.",
    "فونت فارسی با وزن‌های واقعی بارگذاری شده و fallback مناسب دارد.",
    "شماره، URL، مبلغ و کد در متن فارسی با bidi ایمن نمایش داده می‌شوند.",
    "در عرض‌های 375، 768 و 1440 پیکسل هیچ متن مهمی clip یا truncate نشده است.",
    "کنتراست متن عادی حداقل 4.5:1 است و حالت focus واضح است.",
    "معنا فقط با رنگ منتقل نمی‌شود و reduced motion رعایت شده است."
  ];
  return { name: projectName, prompt, stack, score: hit?.score ?? 0, product, tokens, checklist };
}

export function designMarkdown(result: DesignResult): string {
  const colors = Object.entries(result.product.colors).map(([name, value]) => `| ${name} | ${value} |`).join("\n");
  return `# ${result.name}\n\n## مشخصات\n\n- زبان: فارسی\n- جهت: RTL\n- Stack: ${result.stack}\n- الگوی انتخاب‌شده: ${result.product.title}\n- هدف: ${result.product.goal}\n\n## جهت طراحی\n\n${result.product.summary}\n\n- سبک: ${result.product.style}\n- فونت: ${result.product.font.family}، fallback: ${result.product.font.fallback}\n- Heading: ${result.product.font.headingWeight}\n- Body: ${result.product.font.bodyWeight}\n- Line height: ${result.product.font.lineHeight}\n\n## ساختار صفحه\n\n${result.product.sections.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n## کامپوننت‌های اولویت‌دار\n\n${result.product.components.map((item) => `- ${item}`).join("\n")}\n\n## رنگ‌ها\n\n| Token | Value |\n| --- | --- |\n${colors}\n\n## قواعد متن فارسی\n\n${result.product.copyRules.map((item) => `- ${item}`).join("\n")}\n\n## ضدالگوها\n\n${result.product.antiPatterns.map((item) => `- ${item}`).join("\n")}\n\n## چک‌لیست تحویل\n\n${result.checklist.map((item) => `- [ ] ${item}`).join("\n")}\n`;
}

export async function persistDesign(result: DesignResult, outputDirectory: string): Promise<{ directory: string; master: string; tokens: string }> {
  const directory = join(outputDirectory, "design-system", slugify(result.name));
  await mkdir(directory, { recursive: true });
  const master = join(directory, "MASTER.fa.md");
  const tokens = join(directory, "tokens.json");
  await writeFile(master, designMarkdown(result), "utf8");
  await writeFile(tokens, `${JSON.stringify(result.tokens, null, 2)}\n`, "utf8");
  return { directory, master, tokens };
}
