import { ApiError, authorize, reserveUsage, providerFetch, parseResult, failure } from '@/lib/server/ai'
import { displayJapaneseWine } from '@/lib/server/wineDisplay'
import { readWineAnalysis } from '@/lib/server/wineAnalysis'
import { resolveWine } from '@/lib/server/wineLookup'
import { historyContext, readSommelierInput, readSommelierDetails, sommelierPrompt, sommelierSchema, type HistoryWine } from '@/lib/server/sommelierAnalysis'
import { servingTemperature } from '@/lib/servingTemperature'
import { personalRating } from '@/lib/ratings'
import { TASTE_PROFILE_MIN_RECORDS, TASTE_PROFILE_RECORD_LIMIT } from '@/lib/productConfig'
import { calculateTasteProfile, calculateMatchScore, buildMatchReason } from '@/lib/tastePofile'
export const maxDuration = 90
export async function POST(req: Request) {
  try {
    const client = await authorize(req)
    const input = await readSommelierInput(req)
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new ApiError('temporarily_unavailable', 503)
    // RLS remains active; neither history nor ratings are accepted from the caller.
    const {data:rows,error} = await client.from('tastings')
      .select('id,wine_name,producer,vintage,wine_type,body,tannin,acidity,alcohol,grape_variety,country,region,score,stars,created_at')
      .eq('user_id',client.verifiedUserId).or('score.not.is.null,stars.not.is.null')
      .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(TASTE_PROFILE_RECORD_LIMIT)
    if (error) throw new ApiError('temporarily_unavailable',503)
    const records = ((rows || []) as HistoryWine[]).filter(r=>personalRating(r)!==null)
    if (records.length<TASTE_PROFILE_MIN_RECORDS) throw new ApiError('more_tastings_required',403)
    const history=historyContext(records)
    await reserveUsage(client,'sommelier')
    const parts: unknown[]=[{text:sommelierPrompt(input.lang,history,input.hints)}]
    if(input.image) parts.push({inlineData:{mimeType:input.image.imageMediaType,data:input.image.imageBase64}})
    const data=await providerFetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',{
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},
      body:JSON.stringify({contents:[{parts}],generationConfig:{responseMimeType:'application/json',responseJsonSchema:sommelierSchema,maxOutputTokens:3200,thinkingConfig:{thinkingLevel:'minimal'}}}),
    },60000)
    const candidate=data.candidates?.[0]
    if(candidate?.finishReason!=='STOP') throw new ApiError('analysis_failed',502)
    const raw=parseResult(candidate.content?.parts?.filter((p:{thought?:boolean})=>!p.thought).map((p:{text?:string})=>p.text||'').join(''))
    if(!raw.identity || typeof raw.identity!=='object' || Array.isArray(raw.identity)) throw new ApiError('invalid_ai_result',502)
    const identity=raw.identity as Record<string,unknown>
    if(!input.image) {
      // Bind text-only identity to actual user input, not model-invented OCR.
      identity.labelText=Object.values(input.hints).filter(Boolean).join(' ')
      identity.vintage=input.hints.vintage || identity.vintage
      identity.observed={wineName:input.hints.wineName,producer:input.hints.producer}
    }
    const reading=readWineAnalysis(identity,!input.image)
    const wine=await resolveWine(reading)
    const details=readSommelierDetails(raw,history,!!reading.knowledge && reading.knowledge.wineType===wine.wineType)
    const alcoholPercent=input.image && typeof raw.labelAlcohol==='string' && /^\d{1,2}(?:[.,]\d)?\s*[%％]$/.test(raw.labelAlcohol) && reading.labelText.includes(raw.labelAlcohol) ? raw.labelAlcohol : null
    if(!reading.knowledge && !details.clarification) details.clarification=input.lang==='ja' ? '銘柄を特定するため、生産者や裏ラベルの情報を補足してください。' : '와인을 특정할 수 있도록 생산자나 뒷라벨 정보를 보완해주세요.'
    const sameType=records.filter(r=>r.wine_type && r.wine_type===wine.wineType)
    const profile=calculateTasteProfile(sameType)
    const levels=details as typeof details & Record<'bodyLevel'|'tanninLevel'|'acidityLevel'|'alcoholLevel',number|null>
    const match=profile ? calculateMatchScore(profile,{body:levels.bodyLevel,tannin:levels.tanninLevel,acidity:levels.acidityLevel,alcohol:levels.alcoholLevel,grape:wine.grapeVariety,region:wine.region,country:wine.country}) : {score:null,grapeMatched:false,regionMatched:false,structureDiff:0,evidenceCount:0,reason:'insufficient' as const}
    const displayed=displayJapaneseWine(wine,reading.knowledge || reading,reading.japanese || {},input.lang)
    return Response.json({result:{...displayed,labelText:undefined,knowledge:undefined,japanese:undefined,...details,
      servingTemperature:servingTemperature({...wine,bodyLevel:levels.bodyLevel}),
      matchScore:match.score,matchReason:buildMatchReason(input.lang,match),matchRecordCount:match.evidenceCount,
      analysisBasis:'knowledge',historySampleCount:history.length,historyWindowCount:records.length,
      alcoholPercent,priceJPY:null,blendRatio:null,sources:wine.wineResearch.source ? [{url:wine.wineResearch.source,title:input.lang==='ja'?'銘柄・品種の確認資料':'와인·품종 확인 자료'}] : [],researchedAt:null,
    },provider:'gemini'}, {headers:{'Cache-Control':'no-store'}})
  } catch(error) {return failure(error)}
}
