import {countryKey} from '@/lib/countries'
import {CURRENT_WINE_TYPES} from '@/lib/productConfig'

// Equal counts share rank; keys keep the order stable across database responses.
export function frequentWines(rows: {country?: string|null; wine_type?: string|null}[]) {
  const rank = (keys: string[]) => {
    const counts = new Map<string,number>()
    keys.filter(Boolean).forEach(key=>counts.set(key,(counts.get(key)||0)+1))
    return [...counts].sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0],'en')).slice(0,2)
      .map(([key,count],i,all)=>({key,count,rank:i && count===all[0][1]?1:i+1}))
  }
  return {countries:rank(rows.map(row=>countryKey(row.country))),types:rank(rows.map(row=>CURRENT_WINE_TYPES.includes(row.wine_type as typeof CURRENT_WINE_TYPES[number])?row.wine_type! : ''))}
}
