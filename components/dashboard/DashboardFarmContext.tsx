"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { useAuth } from "@/components/auth/AuthProvider"
import type { Farm } from "@/types/farm"
import { supabase } from "@/lib/supabaseClient"

const STORAGE_KEY = "sf-dashboard-farm-id"

export type DashboardFarmContextValue = {
  /** 현재 사용자의 농장 목록 */
  farms: Farm[]
  /** 선택된 농장 id (없으면 null) */
  selectedFarmId: string | null
  /** 선택된 농장 객체 */
  selectedFarm: Farm | null
  setSelectedFarmId: (id: string | null) => void
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const DashboardFarmContext =
  React.createContext<DashboardFarmContextValue | null>(null)

/**
 * 대시보드 상단 농장 선택 등에서 사용하는 컨텍스트 훅.
 */
export const useDashboardFarm = (): DashboardFarmContextValue => {
  const ctx = React.useContext(DashboardFarmContext)
  if (!ctx) {
    throw new Error(
      "useDashboardFarm는 DashboardFarmProvider 안에서만 사용할 수 있습니다.",
    )
  }
  return ctx
}

/**
 * `/dashboard` 구간에서 농장 목록을 불러오고, 선택 농장을 localStorage에 유지한다. (단계 4.1·4.4 기반)
 */
export const DashboardFarmProvider: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const pathname = usePathname()
  const { user } = useAuth()
  const [farms, setFarms] = React.useState<Farm[]>([])
  const [selectedFarmId, setSelectedFarmIdState] = React.useState<
    string | null
  >(null)
  /** 첫 대시보드 진입 시 스피너를 바로 보이게 하기 위해 true로 둔다( refetch 가 끝나면 false ). */
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const isDashboardRoute = pathname.startsWith("/dashboard")

  React.useEffect(() => {
    if (!user?.id) {
      setFarms([])
      setSelectedFarmIdState(null)
      setError(null)
      setIsLoading(false)
    }
  }, [user?.id])

  const refetch = React.useCallback(async () => {
    if (!user?.id || !isDashboardRoute) {
      setFarms([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      // 로그아웃 직후 React user와 서버 세션이 잠깐 어긋나면 /api/farms 가 401이 된다.
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user) {
        setFarms([])
        setSelectedFarmIdState(null)
        return
      }

      const res = await fetch("/api/farms", {
        credentials: "include",
        cache: "no-store",
        signal:
          typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
            ? AbortSignal.timeout(25_000)
            : undefined,
      })
      if (res.status === 401) {
        setFarms([])
        setSelectedFarmIdState(null)
        return
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "농장 목록을 불러오지 못했습니다.")
      }
      const data = (await res.json()) as { farms?: Farm[] }
      const list = Array.isArray(data.farms) ? data.farms : []
      setFarms(list)

      setSelectedFarmIdState((prev) => {
        if (list.length === 0) return null
        const fromStorage =
          typeof window !== "undefined"
            ? window.localStorage.getItem(STORAGE_KEY)
            : null
        const tryId = prev ?? fromStorage
        if (tryId && list.some((f) => f.id === tryId)) return tryId
        return list[0]?.id ?? null
      })
    } catch (e) {
      const aborted =
        e instanceof DOMException
          ? e.name === "AbortError"
          : e instanceof Error && e.name === "AbortError"
      setError(
        aborted
          ? "농장 목록 요청이 시간 초과(25초)되었습니다. 서버를 막 켰다면 첫 요청이 느릴 수 있어 잠시 후 다시 시도해 주세요."
          : e instanceof Error
            ? e.message
            : "목록 조회 오류",
      )
      setFarms([])
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, isDashboardRoute])

  React.useEffect(() => {
    void refetch()
  }, [refetch])

  const setSelectedFarmId = React.useCallback((id: string | null) => {
    setSelectedFarmIdState(id)
    if (typeof window === "undefined") return
    if (id) window.localStorage.setItem(STORAGE_KEY, id)
    else window.localStorage.removeItem(STORAGE_KEY)
  }, [])

  React.useEffect(() => {
    if (!selectedFarmId || farms.length === 0) return
    if (!farms.some((f) => f.id === selectedFarmId)) return
    if (typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, selectedFarmId)
  }, [selectedFarmId, farms])

  const selectedFarm =
    selectedFarmId == null
      ? null
      : (farms.find((f) => f.id === selectedFarmId) ?? null)

  const value = React.useMemo(
    (): DashboardFarmContextValue => ({
      farms,
      selectedFarmId,
      selectedFarm,
      setSelectedFarmId,
      isLoading,
      error,
      refetch,
    }),
    [
      farms,
      selectedFarmId,
      selectedFarm,
      setSelectedFarmId,
      isLoading,
      error,
      refetch,
    ],
  )

  return (
    <DashboardFarmContext.Provider value={value}>
      {children}
    </DashboardFarmContext.Provider>
  )
}
