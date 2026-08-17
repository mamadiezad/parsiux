# تغییرات ParsiUX

## v0.1.0 — ۱۷ اوت ۲۰۲۶

اولین انتشار عمومی ParsiUX.

### هسته‌ی فارسی و طراحی

- جست‌وجوی intentهای فارسی و انگلیسی برای الگوهای محصول
- نرمال‌سازی کاراکترهای فارسی، اعداد و عبارت‌های رایج
- تولید `MASTER.fa.md` و `tokens.json`
- rule packهای پایه، فروشگاه، فین‌تک، رزرو، داشبورد و سلامت

### RTL و کنترل کیفیت

- Static RTL Audit برای جهت سند، logical CSS، Tailwind physical classها، فونت و viewport
- Visual RTL Audit با Chromium و screenshotهای 375، 768 و 1440 پیکسل
- بررسی overflow، focus، target لمسی، bidi و کنتراست مشکوک
- Visual Regression با baseline، pixel diff و گزارش فارسی
- Guardian Quality Gate برای اجرای یکپارچه‌ی auditها در CI
- annotation و summary برای GitHub Actions
- `parsiux fix` برای اصلاح‌های منطقی و کم‌خطر RTL

### تجربه‌ی توسعه

- نصب skill برای Claude Code، Cursor و Agentهای استاندارد
- RTL Gallery برای دیدن نمونه‌های درست و غلط
- Docker image مبتنی بر Playwright
- CI شامل test، Visual Audit، Gallery، baseline و regression comparison

### اعتبارسنجی انتشار

- ۱۶ تست unit و integration پاس شدند
- Visual fixture سالم در هر سه viewport امتیاز 100/100 گرفت
- fixture خراب به‌صورت کنترل‌شده توسط audit و regression fail شد
- GitHub Actions روی branch اصلی سبز است

### نصب

تا انتشار در npm، نسخه‌ی رسمی از GitHub قابل استفاده است:

```bash
git clone https://github.com/mmdverse/parsiux.git
cd parsiux
npm install
npm run build
npm link
```

برای Visual Audit یک‌بار Chromium را نصب کن:

```bash
npx playwright install chromium
```

---

Made ❤️ by [Mohammad](https://t.me/llllxyz) · [@llllxyz](https://t.me/llllxyz)
