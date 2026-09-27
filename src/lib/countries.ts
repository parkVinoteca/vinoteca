// Canonical keys are for comparison only. Historic stored records are not rewritten.
const codes = 'AR AT AU BE BG BO BR CA CH CL CN CY CZ DE DK DZ EG ES FR GB GE GR HR HU IE IL IN IT JP KR LB LU MA MD ME MK MT MX NZ PE PT RO RS RU SI SK TH TN TR UA US UY ZA'.split(' ')
const clean = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase().replace(/[\s・._-]+/g, '')
const aliases = new Map<string, string>()
for (const code of codes) {
  aliases.set(clean(code), code)
  for (const locale of ['en', 'ja', 'ko']) {
    const label = new Intl.DisplayNames([locale], { type: 'region' }).of(code)
    if (label) aliases.set(clean(label), code)
  }
}
for (const [code, names] of Object.entries({ US: ['USA', 'United States of America', 'U.S.A.', 'アメリカ合衆国', '米国'], GB: ['UK', 'United Kingdom', '英国'], JP: ['ジャパン'], KR: ['South Korea', '大韓民国'], ES: ['España', 'Espana'], FR: ['仏国'], IT: ['Italia'], DE: ['Deutschland'] })) {
  for (const name of names) aliases.set(clean(name), code)
}
export function countryKey(value: string | null | undefined): string {
  return value?.trim() ? aliases.get(clean(value)) || value.normalize('NFKC').trim().toLocaleLowerCase() : ''
}
export function countryLabel(value: string | null | undefined, lang: 'ja' | 'ko'): string {
  const key = countryKey(value)
  return codes.includes(key) ? new Intl.DisplayNames([lang], { type: 'region' }).of(key) || value || '' : value?.trim() || ''
}
