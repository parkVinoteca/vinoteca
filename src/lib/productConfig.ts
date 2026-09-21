export const APP_VERSION = '1.4.1'
export const TASTE_PROFILE_RECORD_LIMIT = 300
export const TASTE_PROFILE_MIN_RECORDS = 3

export const RECENCY_WEIGHT_BANDS = [
  { through: 30, weight: 1 },
  { through: 100, weight: 0.6 },
  { through: Number.POSITIVE_INFINITY, weight: 0.3 },
] as const

export type CurrentWineType = 'white' | 'red' | 'rose' | 'sparkling'
export const CURRENT_WINE_TYPES: CurrentWineType[] = ['white', 'red', 'sparkling', 'rose']

// Historic `sweet` records remain readable. New records classify sweetness separately.
export const isCurrentWineType = (value: string): value is CurrentWineType =>
  CURRENT_WINE_TYPES.includes(value as CurrentWineType)
