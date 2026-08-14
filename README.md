# ParsiUX

**موتور تصمیم‌یار UI/UX فارسی و ابزار RTL Audit برای AI coding assistantها**

ParsiUX به‌جای ترجمه‌ی سطحی یک design system انگلیسی، برای ساخت رابط فارسی طراحی شده است: از انتخاب الگوی محصول و فونت تا تولید token و پیدا کردن ایرادهای RTL پیش از انتشار.

> مناسب Next.js، React، Tailwind CSS و shadcn/ui. قابل استفاده کنار Claude Code، Cursor و Agentهای استاندارد.

## چه کاری انجام می‌دهد؟

- جست‌وجوی الگوهای طراحی با عبارت فارسی، انگلیسی و شکل‌های رایج نوشتن آن‌ها
- پیشنهاد ساختار، رنگ، تایپوگرافی، کامپوننت و anti-pattern برای محصول‌های مختلف
- تولید `MASTER.fa.md` و `tokens.json` برای هر پروژه
- بررسی خودکار RTL: جهت صفحه، زبان، فونت فارسی، propertyهای منطقی CSS، کلاس‌های فیزیکی Tailwind و خطرهای overflow
- راهنمای عملی برای متن مختلط، مبلغ، شماره، URL، دسترس‌پذیری و responsive text

## نصب

تا زمان انتشار نخستین نسخه در npm، پروژه را مستقیم از GitHub نصب کن:

```bash
git clone https://github.com/mamadiezad/parsiux.git
cd parsiux
npm install
npm run build
npm link
parsiux --help
```

برای استفاده بدون نصب global هم می‌توانی از `node dist/src/cli.js` استفاده کنی. Node.js 20 یا جدیدتر لازم است.

## شروع سریع

### نصب skill برای agent

```bash
parsiux init --ai claude --target .
parsiux init --ai cursor --target .
parsiux init --ai all --target .
```

### پیدا کردن الگوی مناسب

```bash
parsiux search "فروشگاه اینترنتی پوشاک با پرداخت آنلاین"
parsiux search "appointment booking calendar"
```

### ساخت design system فارسی

```bash
parsiux design "فروشگاه اینترنتی پوشاک با ارسال و پرداخت آنلاین" \
  --stack nextjs \
  --name "فروشگاه پوشاک" \
  --output .
```

خروجی در مسیر زیر ساخته می‌شود:

```text
design-system/فروشگاه-پوشاک/
├── MASTER.fa.md
└── tokens.json
```

### بررسی RTL پروژه

```bash
parsiux audit .
parsiux audit . --strict
parsiux audit . --json
```

حالت `--strict` در صورت وجود error یا warning با exit code غیر صفر تمام می‌شود و برای CI مناسب است.

## نمونه‌ی خروجی Audit

ParsiUX مواردی مثل این‌ها را پیدا می‌کند:

- نبودن `lang="fa"` یا `dir="rtl"`
- استفاده از `margin-left`، `right` و `text-align: left`
- کلاس‌های `ml-*`، `mr-*`، `pl-*`، `pr-*`، `left-*` و `text-left` در Tailwind
- نبودن فونت فارسی شناخته‌شده
- نبودن viewport موبایل
- `overflow: hidden`هایی که احتمال پنهان کردن متن فارسی یا focus دارند

این ابزار جای بازبینی انسانی و screenshot test را نمی‌گیرد؛ اما خطاهای پرتکرار RTL را خیلی زود به تیم نشان می‌دهد.

## قرارداد RTL پیشنهادی

```html
<html lang="fa" dir="rtl">
```

```css
.card {
  margin-inline: auto;
  padding-inline: 1rem;
  inset-inline-start: 0;
  text-align: start;
}
```

برای عدد، لینک، شماره کارت، کد و شناسه‌هایی که باید LTR بمانند، context را صریح تعریف کن و در متن فارسی آن‌ها را isolate نگه دار.

## پوشش اولیه‌ی دانش محصول

- فروشگاه اینترنتی و checkout
- پرداخت و فین‌تک
- رزرو و نوبت‌دهی
- SaaS و پنل سازمانی
- داشبورد تحلیلی
- آموزش آنلاین
- سلامت و کلینیک
- آگهی و مارکت‌پلیس

این دیتاست عمداً کوچک اما قابل بررسی شروع شده است. هر entry باید problem، goal، component، copy rule، anti-pattern و audit hint مشخص داشته باشد؛ فقط اضافه‌کردن لیست رنگ یا اسم یک UI style کافی نیست.

## توسعه

```bash
npm install
npm run verify
```

پروژه با TypeScript و Node استاندارد ساخته شده و وابستگی runtime ندارد. تست‌ها نرمال‌سازی فارسی، relevance جست‌وجو، تولید token و RTL audit را پوشش می‌دهند.

## مسیر توسعه

- افزونه‌ی Playwright برای visual RTL audit در 375، 768 و 1440 پیکسل
- rule packهای پرداخت، فروشگاه، محتوای فارسی و فرم‌های محلی
- adapterهای Nuxt، Flutter و React Native
- gallery نمونه‌های درست و غلط RTL
- corpus عمومی برای سنجش کیفیت جست‌وجوی فارسی

## ریشه و شفافیت

ParsiUX یک پیاده‌سازی مستقل است که از ایده و مسئله‌ای که [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) مطرح کرده الهام گرفته است. هیچ کد منبع، دیتاست یا asset آن پروژه در این ریپو کپی نشده و ParsiUX وابسته یا محصول رسمی آن‌ها نیست. جزئیات در [NOTICE.md](NOTICE.md) آمده است.

---

Made ❤️ by [Mohammad](https://t.me/llllxyz) · [@llllxyz](https://t.me/llllxyz)
