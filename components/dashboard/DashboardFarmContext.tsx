"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { useAuth } from "@/components/auth/AuthProvider"
import type { Farm } from "@/types/farm"

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
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const isDashboardRoute = pathname.startsWith("/dashboard")

  React.useEffect(() => {
    if (!user?.id) {
      setFarms([])
      setSelectedFarmIdState(null)
      setError(null)
    }
  }, [user?.id])

  const refetch = React.useCallback(async () => {
    if (!user?.id || !isDashboardRoute) {
      setFarms([])
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/farms", { credentials: "include" })
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
      setError(e instanceof Error ? e.message : "목록 조회 오류")
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
