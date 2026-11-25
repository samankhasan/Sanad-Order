# Sanad Order

<p align="center"><img src="public/brands/sanad.png" height="140" alt="Sanad Company"></p>

ئەپی داواکردنی بەرهەمەکانی کۆمپانیای سەنەد — **Adan · FAB · Riyadh Paints · Tools**.
یەک کۆد بۆ **وێبگەڕ (PWA)**، **ئەندرۆید** و دواتر **iOS** (Capacitor).

## تایبەتمەندییەکان
- داشبۆرد بە لۆگۆی هەر براندێک، هەر براندێک پەڕە و بەرهەمی خۆی
- گەڕان، ڕیزکردن بەپێی نرخ/ناو، سەبەتە کە بەپێی براند ڕێکخراوە
- ناردنی داواکاری (نرخ هەمیشە لە سێرڤەر حیساب دەکرێت – ناتوانرێت دەستکاری بکرێت)
- دۆخی داواکاری ڕاستەوخۆ (Realtime): چاوەڕوان → پەسەندکرا → ئامادەکردن → لە ڕێگادایە → گەیەندرا
- دووبارە داواکردنەوە، هەڵوەشاندنەوە، ناردن بە واتسئاپ، چاپکردن
- پانێڵی بەڕێوەبەر: ئامار، داواکارییەکان، زیادکردن/دەستکاری بەرهەم بە وێنە (پێش بارکردن بچووک دەکرێتەوە)، کڕیاران
- سێ زمان: کوردی (سۆرانی) · عەرەبی · English — RTL/LTR
- دۆخی تاریک/ڕووناک، کار دەکات بە ئۆفلاین (PWA)، دەتوانرێت لەسەر مۆبایل دابمەزرێت

## ئاگادارکردنەوە (Notifications)
- بەڕێوەبەر: **بەڕێوەبەر → ئاگادارکردنەوەکان** — سەردێڕ، پەیام، وێنە و بەستەر، ناردن بۆ هەموو بەکارهێنەران
- خۆکار: داواکاری نوێ ← بۆ بەڕێوەبەران؛ گۆڕینی دۆخ ← بۆ کڕیار (بە زمانی خۆی)
- ناو ئەپ (Realtime) هەمیشە کار دەکات؛ ئاگادارکردنەوەی مۆبایل/وێبگەڕ بە Firebase Cloud Messaging
- ڕێکخستن: secret ـی `FIREBASE_SERVICE_ACCOUNT` لە Supabase، secret ـی `GOOGLE_SERVICES_JSON` لە GitHub، و variables ـی `FIREBASE_API_KEY`، `FIREBASE_WEB_APP_ID`، `FIREBASE_VAPID_KEY`

## تاقیکردنەوە
| شوێن | چۆن |
|---|---|
| **وێبگەڕ** | Settings → Pages → Source: **GitHub Actions**، پاشان merge بۆ `main`. بەستەر: `https://<user>.github.io/sanad-order/` |
| **ئەندرۆید (APK)** | تابی **Actions** → *Build Android APK* → دوایین run → `SanadOrder-debug-apk` دابەزێنە و لەسەر مۆبایل دایبمەزرێنە |
| **ناوخۆیی** | `npm install` پاشان `npm run dev` |

## بەڕێوەبەر
ئیمەیڵی بەڕێوەبەر لە خشتەی `admin_emails` ـی Supabase دانراوە (لە کۆددا نییە).
هەر کەسێک بەو ئیمەیڵە هەژمار دروست بکات، خۆکار دەبێت بە بەڕێوەبەر. لە پانێڵی «کڕیاران» دەتوانیت بەڕێوەبەری تر زیاد بکەیت.

## Google Play
1. چوار secret ی واژوو لە GitHub دابنێ: `ANDROID_KEYSTORE_BASE64`، `ANDROID_KEYSTORE_PASSWORD`، `ANDROID_KEY_ALIAS`، `ANDROID_KEY_PASSWORD`
2. Actions ← **Android release (Google Play)** ← Run workflow ← فایلی `.aab` دابەزێنە
3. لە Play Console بیخە ناو Internal testing / Production
4. هەموو دەق و وێنەکانی لیست: `store/LISTING.md` و `store/`

## ستاک
React 19 · TypeScript · Vite · Tailwind CSS 4 · Supabase (Auth, Postgres + RLS, Storage, Realtime) · Capacitor 7 · vite-plugin-pwa

## ئاسایش
- تەنها کلیلی `sb_publishable_…` لە ئەپدایە (بۆ وێبگەڕ سەلامەتە چونکە RLS چالاکە).
- **هەرگیز** کلیلی `sb_secret_…` مەخەرە ناو کۆد یان GitHub.
- داتابەیس: `supabase/migrations/`.

## iOS (دواتر)
```bash
npm run build && npx cap add ios && npx cap sync ios && npx cap open ios
```
(پێویستی بە Mac و Xcode هەیە)
