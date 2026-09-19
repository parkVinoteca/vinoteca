// Explicit one-build preview experiment. No endpoint, secrets or customer data are published.
if (process.env.VERCEL_ENV !== 'preview' || !process.env.VERCEL_GIT_COMMIT_MESSAGE?.includes('[critic-benchmark]')) process.exit(0)
const fs = require('node:fs')
const { load } = require('../tests/helpers.cjs')
const ai = load('src/lib/server/ai.ts', { fetch: globalThis.fetch, process: { env: process.env } })
const wines = [
 {wineName:'Chateau Palmer',producer:'Chateau Palmer',vintage:'2019',country:'France',wineType:'red'},
 {wineName:'Reserve Margaux',producer:'Mouton Cadet',vintage:'2022',country:'France',wineType:'red'},
 {wineName:'Sauvignon Blanc',producer:'Cloudy Bay',vintage:'2023',country:'New Zealand',wineType:'white'},
]
const rows=[]
async function main() {
 if(!process.env.ANTHROPIC_API_KEY) throw new Error('benchmark_key_unavailable')
 for(let i=0;i<wines.length;i++) for(const critics of i%2 ? [true,false] : [false,true]) {
  let usage=null, providerStatus='not_called'
  const instrumented = async (...args) => {
   try { const data=await ai.providerFetch(...args); usage=data.usage || null; providerStatus=data.stop_reason; return data }
   catch(error) {providerStatus=error.code || 'request_failed'; throw error}
  }
  const {enrichGrapes}=load('src/lib/server/grapes.ts',{}, {'@/lib/server/ai':{...ai,providerFetch:instrumented}})
  const start=Date.now()
  const result=await enrichGrapes(ai.validateLabel(wines[i]),'ja',process.env.ANTHROPIC_API_KEY,critics)
  const seconds=Number(((Date.now()-start)/1000).toFixed(3))
  // Sonnet 5 standard USD: input2/MTok, output10/MTok, cache read0.2/MTok,
  // cache write 5min2.5/MTok, 1hour4/MTok; search $0.01/request, fetch no separate fee.
  const cost=usage ? ((usage.input_tokens||0)*2+(usage.output_tokens||0)*10+(usage.cache_read_input_tokens||0)*.2+(usage.cache_creation?.ephemeral_5m_input_tokens ?? usage.cache_creation_input_tokens ?? 0)*2.5+(usage.cache_creation?.ephemeral_1h_input_tokens||0)*4)/1e6+(usage.server_tool_use?.web_search_requests||0)*.01 : null
  const row={wine:wines[i],critics,seconds,providerStatus,usage,estimatedUSD:cost,grapeStatus:result.grapeResearch.status,grapes:result.grapeVariety,criticScores:result.criticScores || []}
  rows.push(row)
  console.log('[critic-benchmark]',JSON.stringify(row))
  if(rows.reduce((n,r)=>n+(r.estimatedUSD||0),0)>1) break
 }
 fs.writeFileSync('public/critic-benchmark.json',JSON.stringify({measuredAt:new Date().toISOString(),model:'claude-sonnet-5',scope:'Research only, excluding image extraction. One paired observation per wine, alternating order.',pricingSource:'https://platform.claude.com/docs/en/about-claude/pricing',rows},null,2))
}
main().catch(()=>{console.error('[critic-benchmark] failed; no secrets emitted'); process.exitCode=1})
