# ech-sub-live

اشتراک **خودکار به‌روزرسانی‌شده** v2ray با `ECHConfigList` معتبر — قابل استفاده مستقیم در PattN / ZSecure / v2rayN.

```
https://raw.githubusercontent.com/d4rk-n0153/ech-sub-live/main/subscription.txt
```

## مشکل

اپراتورهای ایران به رکوردهای DNS نوع **HTTPS (SVCB / type 65)** پاسخ مسموم برمی‌گردانند. کانفیگ‌هایی که با `ech=cloudflare-ech.com+udp://1.1.1.1` می‌آیند باعث خطای زیر در هسته Xray می‌شوند:

```
tls: malformed ECHConfigList
```

نتیجه: هیچ‌کدام از نودهای ساب پینگ نمی‌دهند.

## راه‌حل

یک **GitHub Action** هر ۴ ساعت:

1. رکورد HTTPS `cloudflare-ech.com` را از DoH کلادفلر (بدون سانسور) می‌گیرد — با fallback به DNS-over-TCP.
2. پارامتر `ech=` را در همه کانفیگ‌ها با base64 واقعی `ECHConfigList` جایگزین می‌کند.
3. فایل `subscription.txt` را در همین ریپو کامیت می‌کند.

از آنجا که `raw.githubusercontent.com` از ایران مستقیم و کامل دانلود می‌شود، نیازی به سرور یا دامنه نیست — و برخلاف ECH دستی، **کلید تازه نگه داشته می‌شود**.

## استفاده

آدرس بالا را به‌عنوان Subscription URL در برنامه اضافه و Update بزنید.

اجرای دستی: `Actions → update-subscription → Run workflow`
یا محلی: `npm run update`

## نکات

- نودهای **IPv6** روی خط بدون IPv6 کار نمی‌کنند؛ روی نودهای ECH/IPv4 بمانید.
- اگر Action متوقف شد (۶۰ روز عدم فعالیت در ریپوهای public توسط گیتهاب غیرفعال می‌شود)، یک commit دستی یا یک بار Run workflow آن را برمی‌گرداند.

## License

MIT
