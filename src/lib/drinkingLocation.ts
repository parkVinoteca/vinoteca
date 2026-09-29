export type LocationPoint={latitude:number;longitude:number;accuracy:number|null}
export function readLocation(row?:{drinking_latitude?:number|null;drinking_longitude?:number|null;drinking_accuracy?:number|null}|null):LocationPoint|null{
 const lat=row?.drinking_latitude,lng=row?.drinking_longitude,a=row?.drinking_accuracy
 if(typeof lat!=='number'||!Number.isFinite(lat)||Math.abs(lat)>90||typeof lng!=='number'||!Number.isFinite(lng)||Math.abs(lng)>180)return null
 return {latitude:lat,longitude:lng,accuracy:typeof a==='number'&&Number.isFinite(a)&&a>=0&&a<=20040000?a:null}
}
export function locationMap(point:LocationPoint){
 return 'https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:`${point.latitude},${point.longitude}`})
}
export function locationTiles(point:LocationPoint){
 const zoom=19,n=2**zoom,lat=Math.max(-85.05112878,Math.min(85.05112878,point.latitude))*Math.PI/180
 const x=(point.longitude+180)/360*n,y=(1-Math.asinh(Math.tan(lat))/Math.PI)/2*n
 const tx=Math.floor(x),ty=Math.floor(y)
 return {offsetX:256+(x-tx)*256,offsetY:256+(y-ty)*256,tiles:Array.from({length:9},(_,i)=>{
  const col=i%3,row=Math.floor(i/3),tileX=((tx+col-1)%n+n)%n,tileY=Math.max(0,Math.min(n-1,ty+row-1))
  return {x:col*256,y:row*256,url:`https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`}
 })}
}
