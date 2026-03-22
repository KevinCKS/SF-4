"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { supabase } from "@/lib/supabaseClient"
import { isBenignAuthStorageError } from "@/lib/supabaseAuthStorageErrors"
import { CenteredState } from "@/components/common/CenteredState"

/** React Strict Mode에서 effect가 두 번 돌며 signOut이 겹치지 않도록 공유 Promise로 단일화한다. */
let sharedSignOutPromise: Promise<void> | null = null

const getSharedSignOut = (): Promise<void> => {
  if (!sharedSignOutPromise) {
    sharedSignOutPromise = supabase.auth
      .signOut()
      .then(({ error }) => {
        if (error) throw error
      })
      .catch((e: unknown) => {
        if (isBenignAuthStorageError(e)) return
        throw e
      })
      .finally(() => {
        sharedSignOutPromise = null
      })
  }
  return sharedSignOutPromise
}

/**
 * 로그아웃 처리 페이지.
 * Supabase Auth에서 signOut을 호출한 뒤 로그인 페이지로 이동한다.
 */
const LogoutPage: React.FC = () => {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = React.useState(true)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        // 이미 세션이 없으면 저장소 경합 없이 로그인으로 보낸다.
        if (!session) {
          if (!cancelled) router.replace("/login")
          return
        }

        await getSharedSignOut()
        if (cancelled) return

        router.replace("/login")
      } catch (e: unknown) {
        if (isBenignAuthStorageError(e)) {
          if (!cancelled) router.replace("/login")
          return
        }
        setErrorMessage("로그아웃 중 알 수 없는 오류가 발생했습니다.")
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.error("로그아웃 예외:", e)
        }
        setIsSigningOut(false)
      }
    }

    void run()

    return () => {
      cancelled = true
    }
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
