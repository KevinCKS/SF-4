import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * 서버 전용(서비스 롤) Supabase 클라이언트.
 * - MQTT 수신 콜백처럼 **요청·세션 컨텍스트가 없을 때** RLS를 우회해 DB에 쓴다.
 * - `SUPABASE_SERVICE_ROLE_KEY` 는 **절대** 클라이언트 번들에 포함하지 않는다.
 */
let cached: SupabaseClient | null = null

export const getSupabaseServiceRoleClient = (): SupabaseClient | null => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return null
  }
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return cached
}
