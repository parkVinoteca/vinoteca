import { supabase } from './supabase'
import type { Language } from '@/i18n'
export const messages = {
  ja: { sign_in_required: '再度ログインしてください。', usage_limit: '利用上限に達したか、連続したリクエストです。時間をおいてお試しください。', analysis_failed: '解析できませんでした。写真を確認して再度お試しください。', temporarily_unavailable: '現在この機能を利用できません。しばらくしてからお試しください。', invalid_image: 'JPEGまたはPNGのラベル写真を選択してください。', image_too_large: '画像が大きすぎます。小さい画像でお試しください。', label_unreadable: 'ラベルを読み取れませんでした。明るく鮮明な写真でお試しください。', search_unavailable: '出典を確認できませんでした。時間をおいてお試しください。' },
  ko: { sign_in_required: '다시 로그인해주세요.', usage_limit: '사용 한도에 도달했거나 연속 요청입니다. 잠시 후 다시 시도해주세요.', analysis_failed: '분석하지 못했습니다. 사진을 확인하고 다시 시도해주세요.', temporarily_unavailable: '현재 이 기능을 사용할 수 없습니다. 잠시 후 다시 시도해주세요.', invalid_image: 'JPEG 또는 PNG 라벨 사진을 선택해주세요.', image_too_large: '이미지가 너무 큽니다. 더 작은 이미지로 시도해주세요.', label_unreadable: '라벨을 읽지 못했습니다. 밝고 선명한 사진으로 시도해주세요.', search_unavailable: '출처를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.' },
}
export async function analyzeImage(endpoint: 'label' | 'sommelier', image: { base64: string; mediaType: string }, lang: Language) {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) throw new Error(messages[lang].sign_in_required)
  try {
    const response = await fetch(`/api/${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ imageBase64: image.base64, imageMediaType: image.mediaType, lang }), signal: AbortSignal.timeout(55000),
    })
    const body = await response.json()
    if (!response.ok) throw new Error(messages[lang][body.error as keyof typeof messages.ja] || messages[lang].analysis_failed)
    return body.result
  } catch (error) {
    if (error instanceof Error && Object.values(messages[lang]).includes(error.message)) throw error
    throw new Error(messages[lang].analysis_failed, { cause: error })
  }
}
