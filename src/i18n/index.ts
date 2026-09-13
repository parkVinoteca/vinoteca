import { ja } from './ja'
import { ko } from './ko'

export type Language = 'ja' | 'ko'
export type Translations = typeof ja

export const translations: Record<Language, Translations> = { ja, ko }

export function t(lang: Language, key: string): string {
  const keys = key.split('.')
  let value: any = translations[lang]
  for (const k of keys) {
    value = value?.[k]
  }
  return value ?? key
}
