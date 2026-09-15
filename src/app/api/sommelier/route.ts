import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, imageMediaType, lang } = await req.json()

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const prompt = lang === 'ja'
      ? `このワインラベルの写真を分析してください。Web検索を積極的に使い、以下を正確に調査してください：

1. ラベルから読み取れる基本情報（生産者、ワイン名、ヴィンテージ、産地、品種、タイプ）
2. 【重要・必須検索】このワインの正確なヴィンテージ別ブレンド比率。生産者の公式サイト、Vivino、Wine-Searcherを検索して特定してください。
3. 【重要・必須検索】参考価格。まず日本国内のショップを優先的に検索し円で提示。国内情報がなければ海外相場をドルで提示してください。
4. このワインの構造的特徴を1-5の数値で推定してください（ボディ・タンニン・酸味・アルコール度）

必ず実際にWeb検索を行い、正確な情報のみ回答してください。不明な項目は「不明」としてください。

回答は以下のJSON形式のみ（他のテキスト不要）:
{
  "wineName": "ワイン名",
  "producer": "生産者",
  "vintage": "ヴィンテージ",
  "region": "産地",
  "country": "国",
  "wineType": "red/white/rose/sparkling",
  "grapeVariety": "主要品種名（一つ）",
  "bodyLevel": 1-5の数値,
  "tanninLevel": 1-5の数値(白は3固定),
  "acidityLevel": 1-5の数値,
  "alcoholLevel": 1-5の数値,
  "blendRatio": "品種構成",
  "blendSource": "情報の出典",
  "description": "ワインの特徴（2-3文）",
  "characteristics": ["特徴1", "特徴2", "特徴3"],
  "priceJPY": "国内参考価格または null",
  "priceJPYSource": "出典または null",
  "priceUSD": "海外参考価格または null",
  "priceUSDSource": "出典または null",
  "expertScore": "専門家評価（あれば）",
  "recommendedFor": "おすすめのシーン・料理"
}`
      : `이 와인 라벨 사진을 분석해주세요. 웹 검색을 적극 활용해서 다음을 정확히 조사해주세요:

1. 라벨에서 읽을 수 있는 기본 정보 (생산자, 와인명, 빈티지, 산지, 품종, 타입)
2. 【중요・필수 검색】이 와인의 정확한 빈티지별 블렌딩 비율. 생산자 공식 사이트, Vivino, Wine-Searcher를 검색해서 찾아주세요.
3. 【중요・필수 검색】참고 가격. 먼저 국내 쇼핑몰을 우선 검색해서 원화로 제시. 국내 정보가 없으면 해외 시세를 달러로 제시해주세요.
4. 이 와인의 구조적 특징을 1-5 숫자로 추정해주세요 (바디·타닌·산도·알코올 도수)

반드시 실제로 웹 검색을 수행하고, 정확한 정보만 답해주세요. 모르는 항목은 "불명"으로 표기하세요.

답변은 아래 JSON 형식으로만:
{
  "wineName": "와인 이름",
  "producer": "생산자",
  "vintage": "빈티지",
  "region": "산지",
  "country": "나라",
  "wineType": "red/white/rose/sparkling",
  "grapeVariety": "주요 품종명 (하나)",
  "bodyLevel": 1-5 숫자,
  "tanninLevel": 1-5 숫자(화이트는 3 고정),
  "acidityLevel": 1-5 숫자,
  "alcoholLevel": 1-5 숫자,
  "blendRatio": "품종 구성",
  "blendSource": "정보 출처",
  "description": "와인 특징 (2-3문장)",
  "characteristics": ["특징1", "특징2", "특징3"],
  "priceJPY": "국내 참고가격 또는 null",
  "priceJPYSource": "출처 또는 null",
  "priceUSD": "해외 참고가격 또는 null",
  "priceUSDSource": "출처 또는 null",
  "expertScore": "전문가 평가 (있으면)",
  "recommendedFor": "추천 상황・음식"
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1536,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image', source: { type: 'base64', media_type: imageMediaType || 'image/jpeg', data: imageBase64 } },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Claude API error:', response.status, errText)
      return NextResponse.json({ error: `AI analysis failed (${response.status})` }, { status: 500 })
    }

    const data = await response.json()
    const textBlocks = data.content?.filter((b: any) => b.type === 'text') || []
    const fullText = textBlocks.map((b: any) => b.text).join('\n')
    const jsonMatch = fullText.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      return NextResponse.json({ error: 'No valid response from AI' }, { status: 500 })
    }

    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json({ result })
  } catch (error: any) {
    console.error('Sommelier API error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
