const characterMap: Record<string, string> = {
  "ي": "ی",
  "ى": "ی",
  "ك": "ک",
  "ؤ": "و",
  "ۀ": "ه",
  "ة": "ه",
  "أ": "ا",
  "إ": "ا",
  "ٱ": "ا",
  "‌": " ",
  "ـ": ""
};

const digitMap: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9"
};

const stopwords = new Set([
  "و", "یا", "از", "به", "در", "با", "برای", "که", "را", "این", "آن", "یک", "روی", "های", "است", "می", "شود", "the", "and", "for", "with", "from", "into", "to", "of", "a", "an"
]);

const intents: Array<[RegExp, string[]]> = [
  [/فروشگاه|فرو شگاه|shop|store|ecommerce|e commerce|forushgah/i, ["فروشگاه", "خرید", "سبد", "محصول", "پرداخت"]],
  [/پرداخت|درگاه|زرین|idpay|zarin|payment|checkout/i, ["پرداخت", "تومان", "رسید", "امنیت", "تراکنش"]],
  [/نوبت|رزرو|booking|appointment|reserve/i, ["نوبت", "تقویم", "زمان", "رزرو", "یادآوری"]],
  [/داشبورد|گزارش|تحلیل|dashboard|analytics|report/i, ["داشبورد", "شاخص", "فیلتر", "نمودار", "جدول"]],
  [/املاک|ملک|خانه|real estate|property/i, ["املاک", "آگهی", "فیلتر", "نقشه", "تماس"]],
  [/آموزش|دوره|کلاس|learn|course|education/i, ["آموزش", "دوره", "پیشرفت", "ویدیو", "گواهی"]],
  [/سلامت|کلینیک|پزشک|health|clinic|medical/i, ["سلامت", "پزشک", "نوبت", "حریم", "پرونده"]],
  [/نرم افزار|سرویس|اشتراک|saas|b2b/i, ["نرم افزار", "اشتراک", "تیم", "داشبورد", "پلن"]]
];

export function normalizePersian(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[يىكؤۀةأإٱ‌ـ]/g, (char) => characterMap[char] ?? char)
    .replace(/[۰-۹٠-٩]/g, (char) => digitMap[char] ?? char)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function tokenize(value: string): string[] {
  return normalizePersian(value)
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !stopwords.has(token));
}

export function expandQuery(value: string): string[] {
  const normalized = normalizePersian(value);
  const terms = new Set(tokenize(normalized));
  for (const [pattern, additions] of intents) {
    if (pattern.test(normalized)) additions.forEach((term) => terms.add(term));
  }
  return [...terms];
}
