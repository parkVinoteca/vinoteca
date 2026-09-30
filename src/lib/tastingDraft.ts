export type TastingDraft = { wineName:string; producer:string; vintage:string; region:string; country:string; grapeVariety:string; wineType:string; imageUrl:string }
export function sommelierDraft(result:Record<string,unknown>,imageUrl:string):TastingDraft {
 const text=(key:string)=>typeof result[key]==='string' ? result[key] as string : ''
 return {wineName:text('wineName'),producer:text('producer'),vintage:text('vintage'),region:text('region'),country:text('country'),grapeVariety:text('grapeVariety'),wineType:text('wineType'),imageUrl:imageUrl.startsWith('data:image/')?imageUrl:''}
}
