'use client'
import {useEffect,useState} from 'react'
import {supabase} from '@/lib/supabase'
import type {Language} from '@/i18n'
export default function UsageAlerts({lang}:{lang:Language}) {
 const [alerts,setAlerts]=useState<{user_id:string;usage_day:string;request_count:number}[]|null>(null)
 const [error,setError]=useState(false)
 useEffect(()=>{let active=true;(async()=>{
  const {data:admins,error:adminError}=await supabase.from('usage_monitor_admins').select('user_id')
  if(adminError || !admins?.length) return
  const {data,error}=await supabase.from('ai_usage_alerts').select('user_id,usage_day,request_count').order('updated_at',{ascending:false}).limit(30)
  if(active){setAlerts(data || []);setError(Boolean(error))}
 })().catch(()=>{if(active)setError(true)});return()=>{active=false}},[])
 if(alerts===null)return null
 return <section className="card p-4"><h2 className="font-medium">{lang==='ja'?'管理者向け利用状況':'관리자 사용량 알림'}</h2><p className="text-xs mt-2">{lang==='ja'?'1日100回以上のAIリクエスト。利用は制限しません。最新30件（画面を開いた時に更新）。':'하루 AI 요청 100회 이상입니다. 이용은 차단하지 않습니다. 최근 30건(화면을 열 때 갱신).'}</p>{error?<p role="alert">{lang==='ja'?'読み込みに失敗しました':'불러오지 못했습니다'}</p>:alerts.length? <ul>{alerts.map(a=><li className="mt-3 text-xs break-all" key={a.user_id+a.usage_day}>{a.usage_day} · {a.request_count}{lang==='ja'?'回':'회'}<br/>{a.user_id}</li>)}</ul>:<p className="mt-2 text-sm">{lang==='ja'?'該当なし':'해당 없음'}</p>}</section>
}
