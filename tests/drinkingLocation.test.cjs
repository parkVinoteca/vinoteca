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
test('Small map preserves marker and bounds at poles and dateline',()=>{
 for(const point of [{latitude:35,longitude:139,accuracy:10},{latitude:90,longitude:180,accuracy:null}]){
  const url=new URL(locationMap(point))
  assert.equal(url.hostname,'www.openstreetmap.org')
  assert.equal(url.searchParams.get('marker'),`${point.latitude},${point.longitude}`)
  const [west,south,east,north]=url.searchParams.get('bbox').split(',').map(Number)
  assert.ok(west>=-180&&east<=180&&south>=-90&&north<=90)
  const map=locationTiles(point)
  assert.equal(map.tiles.length,9)
  assert.ok(Number.isFinite(map.offsetX)&&Number.isFinite(map.offsetY))
  for(const tile of map.tiles){const parts=new URL(tile.url).pathname.split('/');assert.ok(Number(parts[2])>=0&&Number(parts[2])<2**19);assert.ok(parseInt(parts[3])>=0&&parseInt(parts[3])<2**19)}
 }
})
