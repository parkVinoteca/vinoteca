const test=require('node:test')
const assert=require('node:assert/strict')
const {load}=require('./helpers.cjs')
const {suggestLabelCrop,adjustCrop}=load('src/lib/labelCrop.ts')
function fixture(lightBackground=false){
 const w=128,h=192,data=new Uint8ClampedArray(w*h*4)
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let c=lightBackground?245:110
  if(x>=25&&x<103&&y>35)c=30
  if(x>=35&&x<93&&y>=84&&y<146)c=230
  if(x>=43&&x<85&&[94,95,106,107,122,123,135].includes(y))c=25
  const i=(y*w+x)*4;data[i]=data[i+1]=data[i+2]=c;data[i+3]=255
 }
 return {w,h,data}
}
test('Label proposal encloses print with margin and excludes the bottle neck',()=>{
 for(const bg of [false,true]){
  const {w,h,data}=fixture(bg),box=suggestLabelCrop(data,w,h)
  assert.ok(box);assert.ok(box.x<35/w);assert.ok(box.y<84/h);assert.ok(box.y>0.3)
  assert.ok(box.x+box.width>93/w);assert.ok(box.y+box.height>146/h)
 }
})
test('Blank, dark, border-connected and malformed images safely fall back to whole photo',()=>{
 const {w,h,data}=fixture()
 for(const color of [0,100,255]){
  for(let i=0;i<data.length;i+=4){data[i]=data[i+1]=data[i+2]=color}
  assert.equal(suggestLabelCrop(data,w,h),null)
 }
 assert.equal(suggestLabelCrop([],w,h),null)
})
test('Touch and keyboard geometry clamps every corner without inverting the crop',()=>{
 const box={x:0.2,y:0.2,width:0.6,height:0.6}
 for(const mode of ['move','tl','tr','bl','br'])for(const dx of [-10,-0.1,0,0.1,10])for(const dy of [-10,-0.1,0,0.1,10]){
  const out=adjustCrop(box,mode,dx,dy)
  assert.ok(out.x>=0&&out.y>=0)
  assert.ok(out.width>=0.119&&out.height>=0.119)
  assert.ok(out.x+out.width<=1.00001&&out.y+out.height<=1.00001)
 }
})
