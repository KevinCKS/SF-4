"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { useAuth } from "@/components/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

/**
 * 상단 헤더.
 * 로그인 상태(이메일 표시)와 로그아웃, 로그인/회원가입 이동을 제공한다.
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

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <button
          type="button"
          className="text-sm font-semibold tracking-tight"
          onClick={() => router.push(user ? "/dashboard" : "/login")}
        >
          Smartfarm Web Service
        </button>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner />
              <span>인증 확인 중...</span>
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

