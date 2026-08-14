# ParsiUX

برای هر درخواست UI/UX فارسی، قبل از کدنویسی این ترتیب را رعایت کن:

1. نوع محصول، کاربر اصلی، اقدام اصلی، stack و جهت RTL را مشخص کن.
2. در صورت امکان اجرا کن: `parsiux design "شرح محصول" --stack <stack> --output .`
3. فایل‌های `design-system/*/MASTER.fa.md` و `tokens.json` را مبنای طراحی قرار بده.
4. روی html از `lang="fa"` و `dir="rtl"` استفاده کن.
5. در layout از logical CSS استفاده کن: `margin-inline`، `padding-inline`، `inset-inline-start/end` و `text-align:start/end`.
6. برای متن فارسی، متن مختلط، قیمت، شماره، URL و کد مسیر bidi و overflow را بررسی کن.
7. بعد از پیاده‌سازی اجرا کن: `parsiux audit .`
8. اگر صفحه در مرورگر یا dev server قابل اجراست، یک‌بار Chromium را با `npx playwright install chromium` آماده کن و سپس اجرا کن: `parsiux visual http://localhost:3000 --strict`.
9. نتیجه‌ی audit را رفع کن و screenshotهای 375، 768 و 1440 پیکسل را بازبینی کن.

اولویت‌ها: خوانایی فارسی، اقدام واضح، دسترس‌پذیری، responsive text، focus state، کنتراست و reduced motion.
