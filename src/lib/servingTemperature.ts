// Style/body take precedence: the same grape can produce very different wines.
// Guidance, not a measured property of this bottle. Sources and rule rationale:
// docs/SOMMELIER_GEMINI_REDESIGN.md
export function servingTemperature(wine: { wineType?: string | null; bodyLevel?: number | null; grapeVariety?: string | null }) {
  if (wine.wineType === 'sparkling') return '6–10℃'
  if (wine.wineType === 'rose') return '10–12℃'
  const grape = (wine.grapeVariety || '').normalize('NFKC').toLowerCase().replace(/[・\s-]/g, '')
  if (wine.wineType === 'white') {
    if (wine.bodyLevel != null) return wine.bodyLevel >= 4 ? '10–13℃' : '7–10℃'
    if (/viognier|marsanne|roussanne|ヴィオニエ|マルサンヌ|ルーサンヌ|비오니에|마르산|루산/.test(grape)) return '10–13℃'
    // Chardonnay/Chenin/Sémillon need the wine's body, not a universal grape rule.
    if (/chardonnay|chenin|semillon|sémillon|シャルドネ|シュナン|セミヨン|샤르도네|슈냉|세미용/.test(grape)) return '8–13℃'
    return '7–10℃'
  }
  if (wine.wineType === 'red') {
    if (wine.bodyLevel != null) return wine.bodyLevel <= 2 ? '12–14℃' : wine.bodyLevel >= 4 ? '15–18℃' : '14–16℃'
    // A mixed blend with a fuller grape must not inherit a lone Pinot's range.
    if (/cabernet|syrah|shiraz|tannat|malbec|nebbiolo|tempranillo|mourv[eè]dre|zinfandel|カベルネ|シラー|タナ|マルベック|ネッビオーロ|テンプラニーリョ|ムールヴェードル|ジンファンデル|카베르네|시라|쉬라|타나|말벡|네비올로|템프라니요|무르베드르|진판델/.test(grape)) return '15–18℃'
    if (/pinotnoir|gamay|frappato|zweigelt|ピノノワール|ガメイ|フラッパート|ツヴァイゲルト|피노누아|가메|프라파토|츠바이겔트/.test(grape)) return '12–14℃'
    return '14–16℃'
  }
  return null
}
