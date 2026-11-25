// Iraqi governorates with their main cities / towns (Kurdistan Region first).
// The stored value is the English key; the label is shown in the user's language.
import type { Lang } from './i18n'

export interface Place { en: string; ku: string; ar: string }
export interface Governorate extends Place { places: Place[] }

const p = (en: string, ku: string, ar: string): Place => ({ en, ku, ar })

export const IRAQ: Governorate[] = [
  { ...p('Erbil', 'هەولێر', 'أربيل'), places: [
    p('Erbil', 'هەولێر', 'أربيل'), p('Ankawa', 'عەنکاوە', 'عنكاوا'), p('Soran', 'سۆران', 'سوران'), p('Shaqlawa', 'شەقڵاوە', 'شقلاوة'),
    p('Koya', 'کۆیە', 'كويسنجق'), p('Rawanduz', 'ڕەواندز', 'راوندوز'), p('Choman', 'چۆمان', 'جومان'), p('Mergasor', 'مێرگەسۆر', 'ميركسور'),
    p('Khabat', 'خەبات', 'خبات'), p('Makhmour', 'مەخموور', 'مخمور'), p('Bnaslawa', 'بنەسڵاوە', 'بنصلاوة'), p('Daratu', 'دارەتوو', 'دارتو'),
    p('Harir', 'هەریر', 'حرير'), p('Qushtapa', 'قوشتەپە', 'قوشتبة'), p('Sidakan', 'سیدەکان', 'سيدكان'), p('Diana', 'دیانا', 'ديانا')
  ] },
  { ...p('Sulaymaniyah', 'سلێمانی', 'السليمانية'), places: [
    p('Sulaymaniyah', 'سلێمانی', 'السليمانية'), p('Ranya', 'ڕانیە', 'رانية'), p('Qaladze', 'قەڵادزێ', 'قلعة دزه'), p('Chamchamal', 'چەمچەماڵ', 'جمجمال'),
    p('Kalar', 'کەلار', 'كلار'), p('Darbandikhan', 'دەربەندیخان', 'دربندخان'), p('Penjwen', 'پێنجوێن', 'بنجوين'), p('Said Sadiq', 'سەیدسادق', 'سيد صادق'),
    p('Dukan', 'دوکان', 'دوكان'), p('Mawat', 'ماوەت', 'ماوت'), p('Sharbazher', 'شارباژێڕ', 'شاربازير'), p('Kifri', 'کفری', 'كفري'),
    p('Bazian', 'بازیان', 'بازيان'), p('Arbat', 'عەربەت', 'عربت'), p('Tanjaro', 'تانجەرۆ', 'تانجرو')
  ] },
  { ...p('Duhok', 'دهۆک', 'دهوك'), places: [
    p('Duhok', 'دهۆک', 'دهوك'), p('Zakho', 'زاخۆ', 'زاخو'), p('Akre', 'ئاکرێ', 'عقرة'), p('Amedi', 'ئامێدی', 'العمادية'),
    p('Semel', 'سێمێل', 'سميل'), p('Bardarash', 'بەردەڕەش', 'بردرش'), p('Shekhan', 'شێخان', 'الشيخان'), p('Sarsing', 'سەرسنگ', 'سرسنك'),
    p('Batifa', 'باتیفا', 'باطوفة'), p('Faida', 'فایدە', 'فايدة')
  ] },
  { ...p('Halabja', 'هەڵەبجە', 'حلبجة'), places: [
    p('Halabja', 'هەڵەبجە', 'حلبجة'), p('Khurmal', 'خورماڵ', 'خورمال'), p('Sirwan', 'سیروان', 'سيروان'), p('Biara', 'بیارە', 'بيارة')
  ] },
  { ...p('Kirkuk', 'کەرکووک', 'كركوك'), places: [
    p('Kirkuk', 'کەرکووک', 'كركوك'), p('Dibis', 'دبس', 'الدبس'), p('Hawija', 'حەویجە', 'الحويجة'), p('Daquq', 'داقووق', 'داقوق'), p('Altun Kupri', 'پردێ', 'آلتون كوبري')
  ] },
  { ...p('Nineveh', 'نەینەوا', 'نينوى'), places: [
    p('Mosul', 'مووسڵ', 'الموصل'), p('Sinjar', 'شنگال', 'سنجار'), p('Tal Afar', 'تەلەعفەر', 'تلعفر'), p('Bashiqa', 'باعەشیقە', 'بعشيقة'), p('Hamdaniya', 'حەمدانیە', 'الحمدانية')
  ] },
  { ...p('Baghdad', 'بەغدا', 'بغداد'), places: [p('Baghdad', 'بەغدا', 'بغداد'), p('Abu Ghraib', 'ئەبوغرێب', 'أبو غريب'), p('Mahmudiyah', 'مەحمودیە', 'المحمودية')] },
  { ...p('Basra', 'بەسرە', 'البصرة'), places: [p('Basra', 'بەسرە', 'البصرة'), p('Zubair', 'زوبێر', 'الزبير'), p('Umm Qasr', 'ئوم قەسر', 'أم قصر'), p('Abu Al-Khasib', 'ئەبولخەسیب', 'أبو الخصيب')] },
  { ...p('Salahaddin', 'سەلاحەدین', 'صلاح الدين'), places: [p('Tikrit', 'تکریت', 'تكريت'), p('Samarra', 'سامەڕا', 'سامراء'), p('Tuz Khurmatu', 'دووزخورماتوو', 'طوزخورماتو'), p('Baiji', 'بێجی', 'بيجي'), p('Balad', 'بەلەد', 'بلد')] },
  { ...p('Diyala', 'دیالە', 'ديالى'), places: [p('Baqubah', 'بەعقووبە', 'بعقوبة'), p('Khanaqin', 'خانەقین', 'خانقين'), p('Jalawla', 'جەلەولا', 'جلولاء'), p('Muqdadiyah', 'موقدادیە', 'المقدادية')] },
  { ...p('Anbar', 'ئەنبار', 'الأنبار'), places: [p('Ramadi', 'ڕومادی', 'الرمادي'), p('Fallujah', 'فەلووجە', 'الفلوجة'), p('Haditha', 'حەدیسە', 'حديثة'), p('Hit', 'هیت', 'هيت')] },
  { ...p('Babil', 'بابل', 'بابل'), places: [p('Hilla', 'حیللە', 'الحلة'), p('Musayyib', 'موسەیب', 'المسيب'), p('Iskandariya', 'ئیسکەندەریە', 'الإسكندرية')] },
  { ...p('Karbala', 'کەربەلا', 'كربلاء'), places: [p('Karbala', 'کەربەلا', 'كربلاء'), p('Ain al-Tamr', 'عەین تەمر', 'عين التمر')] },
  { ...p('Najaf', 'نەجەف', 'النجف'), places: [p('Najaf', 'نەجەف', 'النجف'), p('Kufa', 'کووفە', 'الكوفة')] },
  { ...p('Wasit', 'واسط', 'واسط'), places: [p('Kut', 'کووت', 'الكوت'), p('Suwaira', 'سوەیرە', 'الصويرة'), p('Numaniyah', 'نوعمانیە', 'النعمانية')] },
  { ...p('Qadisiyah', 'قادسیە', 'القادسية'), places: [p('Diwaniyah', 'دیوانیە', 'الديوانية'), p('Afak', 'عەفەک', 'عفك')] },
  { ...p('Maysan', 'میسان', 'ميسان'), places: [p('Amarah', 'عەمارە', 'العمارة'), p('Majar al-Kabir', 'مەجەڕ کەبیر', 'المجر الكبير')] },
  { ...p('Dhi Qar', 'زیقار', 'ذي قار'), places: [p('Nasiriyah', 'ناسریە', 'الناصرية'), p('Shatrah', 'شەترە', 'الشطرة'), p('Suq al-Shuyukh', 'سوق شیوخ', 'سوق الشيوخ')] },
  { ...p('Muthanna', 'موسەننا', 'المثنى'), places: [p('Samawah', 'سەماوە', 'السماوة'), p('Rumaitha', 'ڕومەیسە', 'الرميثة')] }
]

const byKey = new Map<string, Place>()
IRAQ.forEach(g => g.places.forEach(pl => byKey.set(pl.en, pl)))

export function placeLabel(key: string | null | undefined, lang: Lang) {
  if (!key) return ''
  const pl = byKey.get(key)
  return pl ? pl[lang] : key
}
export function govLabel(g: Governorate, lang: Lang) { return g[lang] }
