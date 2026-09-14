import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, imageMediaType, lang, userStats } = await req.json()

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const canMatch = userStats?.redCount >= 10 && userStats?.whiteCount >= 10

    const matchStatusJa = canMatch
      ? `ユーザーはこれまで赤${userStats.redCount}本・白${userStats.whiteCount}本を評価済みです。以下のテイスティング履歴を参考に、相性スコア(0-100)を算出してください:\n${JSON.stringify(userStats.history?.slice(0, 15) || [])}`
      : `ユーザーの評価本数がまだ不足しています（赤${userStats?.redCount || 0}/10本、白${userStats?.whiteCount || 0}/10本必要）。matchScoreはnullとし、matchReasonには不足本数を伝えるメッセージを入れてください。`

    const matchStatusKo = canMatch
      ? `사용자는 지금까지 레드 ${userStats.redCount}병, 화이트 ${userStats.whiteCount}병을 평가했습니다. 다음 테이스팅 히스토리를 참고해서 취향 일치도(0-100)를 산출해주세요:\n${JSON.stringify(userStats.history?.slice(0, 15) || [])}`
      : `사용자의 평가 병수가 아직 부족합니다 (레드 ${userStats?.redCount || 0}/10병, 화이트 ${userStats?.whiteCount || 0}/10병 필요). matchScore는 null로 하고, matchReason에는 부족한 병수를 안내하는 메시지를 넣어주세요.`

    const prompt = lang === 'ja'
      ? `このワインラベルの写真を見て、以下を調査してください：

1. ラベルから読み取れる情報（生産者、ワイン名、ヴィンテージ、産地、品種）
2. 【重要】このワインの正確なヴィンテージ別ブレンド比率を、生産者の公式サイト・Vivino・Wine-Searcherなどで検索して特定してください。ラベルだけでは分からない情報です。
3. 【重要】参考価格を検索してください。まず日本国内のショップ（エノテカ、テラダワイン、Wine-Searcher日本版など）を優先的に検索し、見つかった場合は円で提示。国内で見つからない場合は海外相場をドルで提示してください。
4. ${matchStatusJa}

必ず実際にWeb検索を行い、正確な情報のみを回答してください。分からない項目は「不明」としてください。

回答は以下のJSON形式のみ（他のテキスト不要）:
{
  "wineName": "ワイン名",
  "producer": "生産者",
  "vintage": "ヴィンテージ",
  "region": "産地",
  "country": "国",
  "wineType": "red/white/rose/sparkling",
  "blendRatio": "品種構成（例: CS 60%, メルロー 30%, CF 10%）",
  "blendSource": "情報の出典（例: シャトー公式サイト2021年資料）",
  "description": "ワインの特徴（2-3文）",
  "characteristics": ["特徴1", "特徴2", "特徴3"],
  "priceJPY": "国内参考価格（円、例: ¥8,000〜12,000）または null",
  "priceJPYSource": "国内価格の出典サイト名 または null",
  "priceUSD": "海外参考価格（ドル、国内情報がない場合のみ、例: $45〜60）または null",
  "priceUSDSource": "海外価格の出典サイト名 または null",
  "expertScore": "専門家評価（例: WS92点、あれば）",
  "matchScore": ${canMatch ? '数値(0-100)' : 'null'},
  "matchReason": "相性診断の理由、または本数不足メッセージ",
  "recommendedFor": "おすすめのシーン・料理"
}`
      : `이 와인 라벨 사진을 보고 다음을 조사해주세요:

1. 라벨에서 읽을 수 있는 정보 (생산자, 와인명, 빈티지, 산지, 품종)
2. 【중요】이 와인의 정확한 빈티지별 블렌딩 비율을 생산자 공식 사이트·Vivino·Wine-Searcher 등에서 검색해서 찾아주세요. 라벨만으로는 알 수 없는 정보입니다.
3. 【중요】참고 가격을 검색해주세요. 먼저 한국/일본 국내 쇼핑몰을 우선 검색하고, 찾으면 해당 통화로 제시. 국내에서 못 찾으면 해외 시세를 달러로 제시해주세요.
4. ${matchStatusKo}

반드시 실제로 웹 검색을 수행하고, 정확한 정보만 답해주세요. 모르는 항목은 "불명"으로 표기하세요.

답변은 아래 JSON 형식으로만 (다른 텍스트 불필요):
{
  "wineName": "와인 이름",
  "producer": "생산자",
  "vintage": "빈티지",
  "region": "산지",
  "country": "나라",
  "wineType": "red/white/rose/sparkling",
  "blendRatio": "품종 구성 (예: CS 60%, 메를로 30%, CF 10%)",
  "blendSource": "정보 출처 (예: 샤토 공식 사이트 2021년 자료)",
  "description": "와인 특징 (2-3문장)",
  "characteristics": ["특징1", "특징2", "특징3"],
  "priceJPY": "국내 참고가격 (원화, 예: ₩80,000〜120,000) 또는 null",
  "priceJPYSource": "국내 가격 출처 사이트명 또는 null",
  "priceUSD": "해외 참고가격 (달러, 국내 정보 없을 때만, 예: $45〜60) 또는 null",
  "priceUSDSource": "해외 가격 출처 사이트명 또는 null",
  "expertScore": "전문가 평가 (예: WS92점, 있으면)",
  "matchScore": ${canMatch ? '숫자(0-100)' : 'null'},
  "matchReason": "취향 진단 이유 또는 병수 부족 메시지",
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
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
          },
        ],
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: imageMediaType || 'image/jpeg',
                  data: imageBase64,
                },
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Claude API error:', errText)
      return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 })
    }

    const data = await response.json()

    // Extract the final text block (after any tool use blocks)
    const textBlocks = data.content?.filter((b: any) => b.type === 'text') || []
    const fullText = textBlocks.map((b: any) => b.text).join('\n')

    // Extract JSON from the response
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
