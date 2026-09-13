import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,      // 브라우저를 껐다 켜도 로그인 유지
    autoRefreshToken: true,    // 세션 만료 전 자동 갱신 (로그아웃 방지)
    detectSessionInUrl: true,  // OAuth 리다이렉트 후 세션 자동 감지
  },
})

export type Database = {
  public: {
    Tables: {
      tastings: {
        Row: {
          id: string
          user_id: string
          mode: 'normal' | 'blind'
          wine_name: string | null
          producer: string | null
          vintage: number | null
          region: string | null
          country: string | null
          grape_variety: string | null
          wine_type: 'white' | 'red' | 'rose' | 'sparkling' | 'sweet' | null
          label_image_url: string | null
          // Appearance
          color_hue: string | null
          color_depth: string | null
          clarity: string | null
          viscosity: string | null
          // Nose
          nose_intensity: string | null
          nose_condition: string | null
          aromas: string[] | null
          // Palate
          sweetness: string | null
          acidity: string | null
          tannin: string | null
          tannin_texture: string | null
          alcohol: string | null
          body: string | null
          flavor_intensity: string | null
          finish: string | null
          // Conclusions
          blic_balance: number | null
          blic_length: number | null
          blic_intensity: number | null
          blic_complexity: number | null
          quality: string | null
          readiness: string | null
          // Blind deduction
          deduction_type: string | null
          deduction_climate: string | null
          deduction_grape: string | null
          deduction_region: string | null
          deduction_vintage_range: string | null
          deduction_price_range: string | null
          deduction_notes: string | null
          // Answer (blind)
          answer_producer: string | null
          answer_wine: string | null
          // General
          score: number | null
          stars: number | null
          notes: string | null
          food_pairing: string[] | null
          // Expert scores
          ws_score: number | null
          wa_score: number | null
          js_score: number | null
          // Language
          language: 'ja' | 'ko'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['tastings']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['tastings']['Insert']>
      }
      blind_sessions: {
        Row: {
          id: string
          user_id: string
          title: string
          wine_count: number
          status: 'active' | 'completed'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['blind_sessions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['blind_sessions']['Insert']>
      }
    }
  }
}
