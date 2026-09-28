import {ApiError,authorize,failure} from '@/lib/server/ai'
import {parsePlacesRequest,publicPlace} from '@/lib/server/places'
export const maxDuration=30
export async function POST(req:Request){
 try {
  const client=await authorize(req)
  if(process.env.GOOGLE_PLACES_ENABLED!=='true' || !process.env.GOOGLE_PLACES_API_KEY) throw new ApiError('places_unavailable',503)
  // Bound input independently of Content-Length.
  const reader=req.body?.getReader(); if(!reader)throw new ApiError('invalid_request',400)
  const chunks:Uint8Array[]=[]; let size=0
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();throw new ApiError('invalid_request',400)}chunks.push(value)}}finally{reader.releaseLock()}
  let raw;try{raw=JSON.parse(Buffer.concat(chunks).toString())}catch{throw new ApiError('invalid_request',400)}
  const input=parsePlacesRequest(raw)
  const {data,error}=await client.rpc('reserve_places_usage')
  if(error)throw new ApiError('places_unavailable',503)
  if(data!==true)throw new ApiError('places_limit',429)
  const fields='id,displayName,formattedAddress,attributions'
  const nearby=input.kind==='nearby'
  const response=await fetch(nearby?'https://places.googleapis.com/v1/places:searchNearby':`https://places.googleapis.com/v1/places/${encodeURIComponent(input.id!)}?languageCode=${input.lang}`,{
   method:nearby?'POST':'GET',headers:{'Content-Type':'application/json','X-Goog-Api-Key':process.env.GOOGLE_PLACES_API_KEY!, 'X-Goog-FieldMask':nearby?fields.split(',').map(x=>'places.'+x).join(','):fields},
   ...(nearby?{body:JSON.stringify({includedTypes:['restaurant','bar','liquor_store','cafe'],maxResultCount:8,rankPreference:'DISTANCE',languageCode:input.lang,locationRestriction:{circle:{center:{latitude:input.lat,longitude:input.lng},radius:500}}})}:{}),cache:'no-store',signal:AbortSignal.timeout(10000)})
  if(!response.ok)throw new ApiError(response.status===429?'places_limit':'places_unavailable',503)
  const result=await response.json()
  return Response.json({places:(nearby?result.places||[]:[result]).map(publicPlace).filter(Boolean)},{headers:{'Cache-Control':'no-store'}})
 }catch(error){return failure(error)}
}
