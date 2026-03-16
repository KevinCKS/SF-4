 "use client"

import { createBrowserClient } from "@supabase/ssr"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // 개발 단계에서만 경고 로그를 출력한다.
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.warn(
      "Supabase 환경 변수가 설정되지 않았습니다. NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 값을 확인하세요."
    )
  }
}

export const supabase = createBrowserClient(
  supabaseUrl ?? "",
  supabaseAnonKey ?? ""
)

