import {ApiError} from '@/lib/server/ai'
export function parsePlacesRequest(value:unknown):{kind:'nearby'|'detail';lang:'ja'|'ko';lat?:number;lng?:number;id?:string}{
 const v=value as Record<string,unknown>
 if(!v || (v.lang!=='ja'&&v.lang!=='ko'))throw new ApiError('invalid_request',400)
 if(v.kind==='detail'&&typeof v.id==='string'&&/^[A-Za-z0-9_-]{1,255}$/.test(v.id))return {kind:'detail',lang:v.lang,id:v.id}
 if(v.kind==='nearby'&&typeof v.lat==='number'&&Number.isFinite(v.lat)&&Math.abs(v.lat)<=90&&typeof v.lng==='number'&&Number.isFinite(v.lng)&&Math.abs(v.lng)<=180)return {kind:'nearby',lang:v.lang,lat:v.lat,lng:v.lng}
 throw new ApiError('invalid_request',400)
}
export function publicPlace(p:any){
 if(typeof p?.id!=='string'||!/^[A-Za-z0-9_-]{1,255}$/.test(p.id)||typeof p.displayName?.text!=='string')return null
 return {id:p.id,name:p.displayName.text.slice(0,300),address:typeof p.formattedAddress==='string'?p.formattedAddress.slice(0,500):'',attributions:(Array.isArray(p.attributions)?p.attributions:[]).map((a:any)=>({name:typeof a.provider==='string'?a.provider:'',url:typeof a.providerUri==='string'&&a.providerUri.startsWith('https://')?a.providerUri:null}))}
}
