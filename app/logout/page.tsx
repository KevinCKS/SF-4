"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { supabase } from "@/lib/supabaseClient"
import { CenteredState } from "@/components/common/CenteredState"

/**
 * 로그아웃 처리 페이지.
 * Supabase Auth에서 signOut을 호출한 뒤 로그인 페이지로 이동한다.
 */
const LogoutPage: React.FC = () => {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    const run = async () => {
      try {
        const { error } = await supabase.auth.signOut()
        if (error) {
          setErrorMessage(
            error.message || "로그아웃에 실패했습니다. 다시 시도해 주세요.",
          )
          if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line no-console
            console.error("로그아웃 오류:", error)
          }
          setIsSigningOut(false)
          return
        }

        router.replace("/login")
      } catch (e) {
        setErrorMessage("로그아웃 중 알 수 없는 오류가 발생했습니다.")
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.error("로그아웃 예외:", e)
        }
        setIsSigningOut(false)
      }
    }

    run()
  }, [router])

  if (isSigningOut) {
    return (
      <CenteredState
        variant="loading"
        title="로그아웃 처리 중입니다..."
        description="잠시만 기다려 주세요."
      />
    )
  }

  return (
    <CenteredState
      variant={errorMessage ? "error" : "info"}
      title="로그아웃"
      description={errorMessage ?? "로그아웃이 완료되었습니다."}
      actionLabel="로그인 화면으로 이동"
      onAction={() => router.replace("/login")}
    />
  )
}

export default LogoutPage

