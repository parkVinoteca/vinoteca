const test=require('node:test')
const assert=require('node:assert/strict')
const {load}=require('./helpers.cjs')
const {readLocation,locationMap,locationTiles}=load('src/lib/drinkingLocation.ts',{URLSearchParams})
test('Location rejects missing or invalid coordinates but accepts zero',()=>{
 assert.equal(readLocation(null),null)
 assert.equal(readLocation({drinking_latitude:91,drinking_longitude:0}),null)
 assert.equal(readLocation({drinking_latitude:35,drinking_longitude:NaN}),null)
 assert.equal(readLocation({drinking_latitude:0,drinking_longitude:0}).latitude,0)
 assert.equal(readLocation({drinking_latitude:35,drinking_longitude:139,drinking_accuracy:-1}).accuracy,null)
})
test('Map link preserves coordinates and tiles stay in bounds',()=>{
 for(const point of [{latitude:35,longitude:139,accuracy:10},{latitude:90,longitude:180,accuracy:null}]){
  const url=new URL(locationMap(point))
  assert.equal(url.hostname,'www.google.com')
  assert.equal(url.searchParams.get('api'),'1')
  assert.equal(url.searchParams.get('query'),`${point.latitude},${point.longitude}`)
  const map=locationTiles(point)
  assert.equal(map.tiles.length,9)
  assert.ok(Number.isFinite(map.offsetX)&&Number.isFinite(map.offsetY))
  for(const tile of map.tiles){const parts=new URL(tile.url).pathname.split('/');assert.ok(Number(parts[2])>=0&&Number(parts[2])<2**19);assert.ok(parseInt(parts[3])>=0&&parseInt(parts[3])<2**19)}
 }
})
