"use client"

import * as React from "react"
import type { Session, User } from "@supabase/supabase-js"

import { supabase } from "@/lib/supabaseClient"

type AuthState = {
  isLoading: boolean
  session: Session | null
  user: User | null
}

const AuthContext = React.createContext<AuthState | null>(null)

/**
 * Supabase 인증 상태를 전역으로 관리하는 Provider.
 * 로그인/로그아웃 상태 변화가 즉시 UI에 반영되도록 구독한다.
 */
export const AuthProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [state, setState] = React.useState<AuthState>({
    isLoading: true,
    session: null,
    user: null,
  })

  React.useEffect(() => {
    let isMounted = true

    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!isMounted) return

        setState({
          isLoading: false,
          session,
          user: session?.user ?? null,
        })
      } catch (e) {
        if (!isMounted) return
        setState({ isLoading: false, session: null, user: null })
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.error("Auth 세션 초기화 오류:", e)
        }
      }
    }

    init()

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return
        setState({
          isLoading: false,
          session,
          user: session?.user ?? null,
        })
      },
    )

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

/**
 * 전역 인증 상태 훅.
 */
export const useAuth = () => {
  const ctx = React.useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.")
  }
  return ctx
}

