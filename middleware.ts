import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

type CookieOptions = {
  path?: string
  domain?: string
  maxAge?: number
  expires?: Date
  httpOnly?: boolean
  secure?: boolean
  sameSite?: "lax" | "strict" | "none"
}

/**
 * SSR 쿠키 기반 Supabase 세션을 사용하는 middleware.
 * - 미로그인 사용자가 보호 라우트에 접근하면 /login 으로 리다이렉트
 * - 로그인 상태에서 로그인/회원가입/비밀번호 관련 페이지 접근 시 /dashboard 로 리다이렉트
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: "", ...options, maxAge: 0 })
        },
      },
    },
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const pathname = req.nextUrl.pathname

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"

  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname === "/" ||
    pathname === "/logout"

  // 1) 보호 라우트에 미로그인 접근 → 로그인 페이지로 리다이렉트
  if (!session && isProtected) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirectTo", pathname + req.nextUrl.search)
    return NextResponse.redirect(url)
  }

  // 2) 로그인 상태에서 인증 페이지 접근 → 대시보드로 리다이렉트
  if (session && isAuthPage) {
    const url = req.nextUrl.clone()
    url.pathname = "/dashboard"
    url.searchParams.delete("redirectTo")
    return NextResponse.redirect(url)
  }

  // 3) 로그인 상태에서 루트(/) 접근 → 대시보드로 리다이렉트
  // (app/page.tsx는 placeholder만 있어서, 여기서 보내지 않으면 "불러오는 중"에 머무름)
  if (session && pathname === "/") {
    const url = req.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/logout",
    "/dashboard/:path*",
  ],
}

