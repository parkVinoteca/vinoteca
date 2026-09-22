'use client'
import {useState} from 'react'
import {supabase} from '@/lib/supabase'
export default function Benchmark(){
 const [photo,setPhoto]=useState(''),[name,setName]=useState(''),[busy,setBusy]=useState(false),[output,setOutput]=useState('')
 async function choose(file:File){
  const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas'),scale=Math.min(1,1024/Math.max(bitmap.width,bitmap.height))
  canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close()
  setPhoto(canvas.toDataURL('image/jpeg',0.85).split(',')[1]);setName(file.name)
 }
 async function run(mode:string){
  setBusy(true)
  try{const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error('Previewホームでログインしてください')
   const started=Date.now(),r=await fetch('/api/sommelier-benchmark?mode='+mode,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({imageBase64:photo,imageMediaType:'image/jpeg',lang:'ja'})});const data=await r.json();setOutput(JSON.stringify({photo:name,status:r.status,totalMs:Date.now()-started,...data},null,2))
  }catch(e){setOutput(e instanceof Error?e.message:'failed')}finally{setBusy(false)}
 }
 return <main className="p-6 max-w-4xl mx-auto"><h1>ソムリエ比較・管理者専用 Preview</h1><p>各ボタンは実際のAPIを1回呼びます。Claudeは有料です。記録保存なし。</p><input aria-label="比較する写真" type="file" accept="image/jpeg,image/png" disabled={busy} onChange={e=>{if(e.target.files?.[0])void choose(e.target.files[0])}}/><p>{name}</p><div className="flex gap-4 my-4">{['gemini','claude','search','comments'].map(m=><button className="border p-3" key={m} disabled={!photo||busy} onClick={()=>void run(m)}>{m}</button>)}</div><p role="status">{busy?'計測中':'待機'}</p><textarea aria-label="比較結果 JSON" className="w-full h-[65vh] text-black bg-white" readOnly value={output}/></main>
}
