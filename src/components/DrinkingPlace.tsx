'use client'
import {useEffect,useRef,useState} from 'react'
import {supabase} from '@/lib/supabase'
import type {Language} from '@/i18n'
type Place={id:string;name:string;address:string;attributions:{name:string;url:string|null}[]}
export default function DrinkingPlace({lang,placeId,onSelect}:{lang:Language;placeId:string;onSelect?:(id:string)=>void}){
 const ja=lang==='ja'
 const [places,setPlaces]=useState<Place[]>([])
 const [selected,setSelected]=useState<Place|null>(null)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const request=useRef<AbortController|null>(null)
 const operation=useRef(0)
 const active=useRef(true)
 const selectedKey=useRef('')
 async function call(body:object,signal:AbortSignal){
  const {data:{session}}=await supabase.auth.getSession()
  if(!session)throw new Error('sign_in_required')
  const response=await fetch('/api/places',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({...body,lang}),signal})
  const data=await response.json()
  if(!response.ok)throw new Error(data.error||'places_unavailable')
  return data.places as Place[]
 }
 useEffect(()=>{active.current=true;return()=>{active.current=false;operation.current++;request.current?.abort()}},[])
 useEffect(()=>{
  setError('')
  if(!placeId){setSelected(null);selectedKey.current='';return}
  if(selectedKey.current===`${placeId}:${lang}`)return
  setSelected(null)
  const controller=new AbortController();request.current=controller
  call({kind:'detail',id:placeId},controller.signal).then(rows=>{if(!controller.signal.aborted){setSelected(rows[0]||null);selectedKey.current=`${placeId}:${lang}`}}).catch(()=>{if(!controller.signal.aborted)setError(ja?'店舗情報を取得できません。Google Mapsで確認できます。':'가게 정보를 불러오지 못했습니다. Google Maps에서 확인할 수 있습니다.')})
  return()=>controller.abort()
 // Keep provider content in memory only; refresh when the saved place or language changes.
 },[placeId,lang])
 async function nearby(){
  if(busy)return
  const id=++operation.current
  setBusy(true);setError('');setPlaces([])
  try{
   if(!navigator.geolocation)throw new Error('location')
   const position=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{timeout:10000,maximumAge:0,enableHighAccuracy:false}))
   if(!active.current||operation.current!==id)return
   const controller=new AbortController();request.current=controller
   const rows=await call({kind:'nearby',lat:position.coords.latitude,lng:position.coords.longitude},controller.signal)
   if(!active.current||operation.current!==id)return
   setPlaces(rows)
   if(!rows.length)setError(ja?'近くの店舗が見つかりません。場所を直接入力してください。':'주변 가게가 없습니다. 장소를 직접 입력해주세요.')
  }catch(e){if(active.current&&operation.current===id)setError(e instanceof Error&&e.message==='places_limit'?(ja?'検索の利用枠に達しました。場所を直接入力してください。':'장소 검색 한도에 도달했습니다. 직접 입력해주세요.'):(ja?'現在地・店舗を取得できませんでした。位置情報の許可を確認するか、直接入力してください。':'위치 또는 가게 정보를 찾지 못했습니다. 위치 권한을 확인하거나 직접 입력해주세요.'))}
  finally{if(active.current&&operation.current===id)setBusy(false)}
 }
 const link=(id:string)=>`https://www.google.com/maps/search/?api=1&query=place&query_place_id=${encodeURIComponent(id)}`
 const attribution=(p:Place)=><>{p.attributions.map((a,i)=>a.url?<a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block underline text-xs">{a.name}</a>:<span key={i} className="block text-xs">{a.name}</span>)}</>
 return <div className="mt-3 space-y-2">
  {onSelect&&<><button type="button" onClick={nearby} disabled={busy} className="btn-secondary text-sm min-h-11 w-full">{busy?(ja?'現在地から検索中…':'주변 장소를 찾는 중…'):(ja?'現在地からお店を探す':'현재 위치에서 가게 찾기')}</button><p className="text-xs text-cave-100">{ja?'ボタンを押すと位置情報の許可を求め、検索のため現在地をGoogleに送信します。位置情報は記録に保存しません。':'버튼을 누르면 위치 권한을 요청하고 검색을 위해 현재 위치를 Google에 보냅니다. 좌표는 기록에 저장하지 않습니다.'}</p></>}
  {error&&<p role="status" className="text-xs text-cave-100">{error}</p>}
  {(selected||places.length>0)&&<div className="border border-cave-400/30 rounded-lg p-3 bg-white space-y-3">
   <span translate="no" className="text-xs font-normal not-italic whitespace-nowrap text-[#5E5E5E]">Google Maps</span>
   {selected&&<div><p className="font-medium text-sm">{selected.name}</p><p className="text-xs">{selected.address}</p>{attribution(selected)}</div>}
   {places.map(p=><div key={p.id}><button type="button" className="text-left min-h-11 w-full border-t border-cave-400/30 py-2" onClick={()=>{selectedKey.current=`${p.id}:${lang}`;setSelected(p);setPlaces([]);onSelect?.(p.id)}}><span className="block text-sm font-medium">{p.name}</span><span className="block text-xs">{p.address}</span></button>{attribution(p)}</div>)}
  </div>}
  {placeId&&<div className="flex gap-4 text-sm"><a className="underline" href={link(placeId)} target="_blank" rel="noopener noreferrer">{ja?'Google Mapsで見る':'Google Maps에서 보기'}</a>{onSelect&&<button type="button" className="underline" onClick={()=>{setSelected(null);setPlaces([]);onSelect('')}}>{ja?'店舗の選択を解除':'가게 선택 해제'}</button>}</div>}
 </div>
}
