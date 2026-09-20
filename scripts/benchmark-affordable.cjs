// Explicitly approved, one Preview commit only. No secrets or customer images in output.
if (process.env.VERCEL_ENV !== 'preview' || !process.env.VERCEL_GIT_COMMIT_MESSAGE?.includes('[approved-affordable-documents]')) process.exit(0)
const fs=require('node:fs'), sharp=require('sharp'), {load}=require('../tests/helpers.cjs')
const wines=[['Chateau Palmer','Margaux','2019','France'],['Mouton Cadet','Reserve Margaux','2022','France'],['Cloudy Bay','Sauvignon Blanc','2023','New Zealand']]
const real=load('src/lib/server/ai.ts',{fetch:globalThis.fetch,process:{env:process.env}})
async function main(){
 const rows=[]
 for(const wine of wines){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="650" height="600"><rect width="650" height="600" fill="white"/>${wine.map((s,i)=>`<text x="30" y="${100+i*100}" font-size="40" fill="black">${s}</text>`).join('')}</svg>`
  const image={imageBase64:(await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64'),imageMediaType:'image/png',lang:'ja'}
  for(const endpoint of ['label','sommelier']){
   const calls=[]
   const providerFetch=async(url,init,timeout)=>{
    const b=JSON.parse(init.body),model=b.model||url.split('/models/')[1]?.split(':')[0],t=Date.now()
    try{const data=await real.providerFetch(url,init,timeout);calls.push({model,seconds:(Date.now()-t)/1000,status:'ok',usage:data.usage||data.usageMetadata||null,stop:data.stop_reason||data.candidates?.[0]?.finishReason,diagnostic:data.content ? (()=>{
      const blocks=data.content;let obj={};try{obj=real.parseResult(blocks.filter(x=>x.type==='text').map(x=>x.text).join(''))}catch{}
      const norm=x=>String(x||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim()
      const fetched=blocks.filter(x=>x.type==='web_fetch_tool_result').map(x=>({url:x.content?.url,type:x.content?.content?.source?.type,chars:x.content?.content?.source?.data?.length||0, matchesSource:x.content?.url===obj.source,head:x.content?.content?.source?.data?.slice(0,180),tail:x.content?.content?.source?.data?.slice(-180), evidenceMatches:Array.isArray(obj.grapes)?obj.grapes.map(g=>({name:g.name,quoteMatches:norm(x.content?.content?.source?.data).includes(norm(g.evidence))})):[]}))
      return {fields:Object.keys(obj),wineMatched:obj.wineMatched,vintageMatched:obj.vintageMatched,source:obj.source,grapes:obj.grapes,fetched}
     })():null});return data}
    catch(e){calls.push({model,seconds:(Date.now()-t)/1000,status:e.code||'failed'});throw e}
   }
   const handler=load(`src/app/api/${endpoint}/route.ts`,{fetch:globalThis.fetch,process:{env:process.env}},{'@/lib/server/ai':{...real,providerFetch,authorize:async()=>({}),reserveUsage:async()=>{}}})
   const start=Date.now(),response=await handler.POST(new Request('https://test.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(image)}))
   rows.push({wine:wine.join(' '),endpoint,status:response.status,seconds:(Date.now()-start)/1000,calls,response:await response.json()})
  }
 }
 fs.mkdirSync('public',{recursive:true});fs.writeFileSync('public/affordable-probe.json',JSON.stringify({measuredAt:new Date().toISOString(),scope:'Synthetic readable wine labels; real provider calls, no customer data. API quotas bypassed in build-only fixture, not app endpoints.',rows},null,2))
 console.log('[affordable-probe] completed',rows.length)
}
main().catch(()=>{console.error('[affordable-probe] failed; no provider text emitted');process.exitCode=1})
