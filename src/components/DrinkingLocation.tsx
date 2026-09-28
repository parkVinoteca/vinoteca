'use client'
import {useEffect,useRef,useState} from 'react'
import {locationMap,locationTiles,readLocation,type LocationPoint} from '@/lib/drinkingLocation'
import type {Language} from '@/i18n'
export default function DrinkingLocation({lang,value,onChange}:{lang:Language;value:LocationPoint|null;onChange?:(point:LocationPoint|null)=>void}){
 const ja=lang==='ja',active=useRef(true),requestId=useRef(0)
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[showMap,setShowMap]=useState(false)
 const tiles=value?locationTiles(value):null
 useEffect(()=>{active.current=true;return()=>{active.current=false;requestId.current++}},[])
 const locate=()=>{
  if(busy)return
  if(!navigator.geolocation){setError(ja?'この端末では位置情報を使えません。場所を直接入力できます。':'이 기기는 위치 정보를 지원하지 않습니다. 장소를 직접 입력할 수 있습니다.');return}
  const id=++requestId.current
  setBusy(true);setError('')
  navigator.geolocation.getCurrentPosition(position=>{
   if(!active.current||id!==requestId.current)return
   const point=readLocation({drinking_latitude:position.coords.latitude,drinking_longitude:position.coords.longitude,drinking_accuracy:position.coords.accuracy})
   if(point){onChange?.(point);setShowMap(true)}else setError(ja?'位置を確認できませんでした。':'위치를 확인하지 못했습니다.')
   setBusy(false)
  },e=>{if(!active.current||id!==requestId.current)return;setBusy(false);setError(e.code===1?(ja?'位置情報が許可されていません。場所を直接入力することもできます。':'위치 권한이 허용되지 않았습니다. 장소를 직접 입력해도 됩니다.'):(ja?'現在地を取得できませんでした。電波の良い場所で再度お試しください。':'현재 위치를 가져오지 못했습니다. 신호가 좋은 곳에서 다시 시도해주세요.'))},{enableHighAccuracy:true,timeout:15000,maximumAge:0})
 }
 return <div className="my-3 space-y-2">
  {onChange&&<><button type="button" disabled={busy} onClick={locate} className="btn-secondary w-full min-h-11 text-sm">{busy?(ja?'現在地を取得中…':'위치를 가져오는 중…'):value?(ja?'現在地を取り直す':'현재 위치 다시 가져오기'):(ja?'現在地を記録':'현재 위치 기록')}</button><p className="text-xs text-cave-100">{ja?'端末の位置情報を使います。記録の保存時に位置も保存します。地図表示のため座標をOpenStreetMapに送信します。店名は下に直接入力してください。':'기기의 위치 정보를 사용하며 기록을 저장할 때 위치도 저장합니다. 지도 표시를 위해 좌표를 OpenStreetMap에 보냅니다. 가게 이름은 아래에 직접 입력해주세요.'}</p></>}
  {error&&<p role="status" className="text-xs text-cave-100">{error}</p>}
  {value&&<>
   <p className="text-xs">{ja?'記録する位置':'기록 위치'}: {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}{value.accuracy!==null&&` (${ja?'端末の推定精度':'기기 추정 정확도'} ±${Math.round(value.accuracy)}m)`}</p>
   {showMap?<><div role="img" aria-label={ja?'記録した位置の地図':'기록한 위치 지도'} className="relative w-full h-52 rounded-lg border border-cave-400/30 overflow-hidden bg-cave-400/10"><div className="absolute left-1/2 top-1/2" style={{transform:`translate(${-tiles!.offsetX}px, ${-tiles!.offsetY}px)`}}>{tiles!.tiles.map((tile,i)=><img key={i} src={tile.url} alt="" width={256} height={256} className="absolute max-w-none" style={{left:tile.x,top:tile.y}}/>)}</div><svg viewBox="0 0 32 42" className="absolute left-1/2 top-1/2 w-8 h-11 -translate-x-1/2 -translate-y-full drop-shadow" aria-hidden="true"><path d="M16 40C12 33 2 23 2 15a14 14 0 0128 0c0 8-10 18-14 25Z" fill="#a30b2b" stroke="white" strokeWidth="2"/><circle cx="16" cy="15" r="5" fill="white"/></svg></div><a className="block text-xs underline" href={locationMap(value)} target="_blank" rel="noopener noreferrer">{ja?'大きな地図を開く':'큰 지도 열기'}</a><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-xs underline">© OpenStreetMap contributors</a></>:<button type="button" onClick={()=>setShowMap(true)} className="btn-secondary min-h-11 text-sm">{ja?'地図を表示（座標をOpenStreetMapに送信）':'지도 보기 (좌표를 OpenStreetMap에 전송)'}</button>}
   {onChange&&<button type="button" className="block text-xs underline min-h-11" onClick={()=>{requestId.current++;setBusy(false);onChange(null);setShowMap(false);setError('')}}>{ja?'位置情報を外す':'위치 정보 제거'}</button>}
  </>}
 </div>
}
