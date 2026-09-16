import { supabase } from './supabase'
export function labelImagePath(value: string, userId: string): string | null {
  let path = value
  if (value.startsWith('https://')) {
    const url = new URL(value)
    const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host
    if (url.host !== host) return null
    const prefix = '/storage/v1/object/public/label-images/'
    if (!url.pathname.startsWith(prefix)) return null
    path = decodeURIComponent(url.pathname.slice(prefix.length))
  }
  if (!path.startsWith(`${userId}/`) || path.includes('..')) return null
  return path
}
export async function resolveLabelImage(value: string | null, userId: string) {
  if (!value) return null
  const path = labelImagePath(value, userId)
  if (!path) return null
  const { data, error } = await supabase.storage.from('label-images').createSignedUrl(path, 3600)
  return error ? null : data.signedUrl
}
