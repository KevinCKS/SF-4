import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

/**
 * 서버 컴포넌트/Route Handler에서 사용하는 Supabase 클라이언트.
 * SSR 쿠키 기반 세션을 활용한다.
 */
export const createSupabaseServerClient = () => {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 })
        },
      },
    },
  )
}

