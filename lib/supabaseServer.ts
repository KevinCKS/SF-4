import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

/**
 * 서버 컴포넌트/Route Handler에서 사용하는 Supabase 클라이언트.
 * SSR 쿠키 기반 세션을 활용한다. (Next.js 16: cookies()는 Promise)
 */
export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component 등에서 set이 막힐 수 있음 — 무시
          }
        },
      },
    },
  )
}
