import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
let client: SupabaseClient<Database> | undefined
// Resolve only when used in the browser; builds do not require deployment secrets.
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, property) {
    if (!isSupabaseConfigured) throw new Error('Service configuration unavailable')
    client ??= createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
    const value = Reflect.get(client, property)
    return typeof value === 'function' ? value.bind(client) : value
  },
})

export type Database = {
  public: {
    Views: {}
    Functions: { reserve_ai_usage: { Args: { p_feature: string }; Returns: boolean } }
    Enums: {}
    CompositeTypes: {}
    Tables: {
      ai_usage_logs: {
        Row: { id: string; user_id: string; feature: string; created_at: string }
        Insert: never
        Update: never
        Relationships: []
      }
      profiles: {
        Row: { id: string; plan: 'free' | 'paid'; created_at: string; updated_at: string }
        Insert: never
        Update: never
        Relationships: []
      }
      subscription_limits: {
        Row: { plan: 'free' | 'paid'; tasting_monthly_limit: number | null; sommelier_monthly_limit: number }
        Insert: never
        Update: never
        Relationships: []
      }
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
          nose_development: string | null
          nose_condition: string | null
          aromas: string[] | null
          // Palate
          sweetness: string | null
          acidity: string | null
          tannin: string | null
          tannin_texture: string | null
          mousse: string | null
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
          palate_notes: string | null
          blind_session_id: string | null
          blind_wine_number: number | null
          notes: string | null
          food_pairing: string[] | null
          critic_scores: import('./criticScores').CriticScore[] | null
          // Expert scores
          ws_score: number | null
          wa_score: number | null
          js_score: number | null
          // Language
          language: 'ja' | 'ko'
          created_at: string
        }
        Relationships: []
        Insert: Partial<Database['public']['Tables']['tastings']['Row']> & { user_id: string }
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
        Relationships: []
        Insert: Partial<Database['public']['Tables']['blind_sessions']['Row']> & { user_id: string; title: string }
        Update: Partial<Database['public']['Tables']['blind_sessions']['Insert']>
      }
    }
  }
}
