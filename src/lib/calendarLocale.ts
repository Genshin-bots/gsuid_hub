import { format } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { ja } from 'date-fns/locale/ja';
import { zhCN } from 'date-fns/locale/zh-CN';
import type { Language } from '@/contexts/LanguageContext';

export function getCalendarLocale(language?: Language) {
  switch (language) {
    case 'en-US':
      return enUS;
    case 'ja-JP':
      return ja;
    default:
      return zhCN;
  }
}

export function formatCalendarCaption(date: Date, language?: Language): string {
  const locale = getCalendarLocale(language);
  if (language === 'en-US') {
    return format(date, 'MMMM yyyy', { locale });
  }
  return format(date, 'yyyy年M月', { locale });
}
