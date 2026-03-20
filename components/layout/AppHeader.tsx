"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { useAuth } from "@/components/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

/**
 * 전역 상단 헤더(로그인·회원가입 등).
 * `/dashboard` 는 사이드바만 사용하므로 헤더를 렌더하지 않는다.
 */
export const AppHeader: React.FC = () => {
  const router = useRouter()
  const pathname = usePathname()
  const { isLoading, user } = useAuth()

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"

  const isDashboard = pathname.startsWith("/dashboard")

  const homeHref = user ? "/dashboard" : "/login"

  /** 대시보드는 사이드바에 로고·메뉴·농장 선택이 있으므로 상단 헤더를 숨긴다. */
  if (isDashboard) {
    return null
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
        <div className="shrink-0">
          <Link
            href={homeHref}
            className="text-lg font-semibold tracking-tight text-foreground hover:underline sm:text-xl"
          >
            Smartfarm Web Service
          </Link>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner />
              <span className="hidden sm:inline">인증 확인 중...</span>
            </div>
          ) : user ? (
            <>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {user.email ?? "로그인 사용자"}
              </span>
              <Button variant="outline" onClick={() => router.push("/logout")}>
                로그아웃
              </Button>
            </>
          ) : (
            <>
              <Button
                variant={isAuthPage ? "outline" : "default"}
                onClick={() => router.push("/login")}
              >
                로그인
              </Button>
              <Button variant="outline" onClick={() => router.push("/signup")}>
                회원가입
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
