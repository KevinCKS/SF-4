"use client"

import * as React from "react"
import Link from "next/link"

import { useDashboardFarm } from "@/components/dashboard/DashboardFarmContext"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

type DashboardFarmSelectProps = {
  /** 사이드바에서는 전체 너비 사용 */
  layout?: "header" | "sidebar"
}

/**
 * 농장 선택 드롭다운. 헤더 또는 사이드바에서 사용한다.
 */
export const DashboardFarmSelect: React.FC<DashboardFarmSelectProps> = ({
  layout = "header",
}) => {
  const {
    farms,
    selectedFarmId,
    setSelectedFarmId,
    isLoading,
    error,
    refetch,
  } = useDashboardFarm()

  if (isLoading && farms.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner className="size-4" />
        <span className="hidden sm:inline">농장 목록 불러오는 중…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex max-w-xs flex-col items-center gap-1 sm:flex-row">
        <span className="text-center text-xs text-destructive">{error}</span>
        <Button variant="ghost" size="sm" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </div>
    )
  }

  if (farms.length === 0) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard/farms">농장 등록하기</Link>
      </Button>
    )
  }

  const effectiveFarmId = selectedFarmId ?? farms[0]?.id ?? ""

  return (
    <div
      className={cn(
        "w-full",
        layout === "header" && "max-w-xs sm:max-w-sm",
      )}
    >
      <span className="sr-only">농장 선택</span>
      <Select
        value={effectiveFarmId}
        onValueChange={(id) => setSelectedFarmId(id)}
      >
        <SelectTrigger
          className={cn(
            "h-9 w-full min-w-[10rem] rounded-xl border border-sidebar-border/80 bg-card/40 px-3 text-xs shadow-sm shadow-primary/5 backdrop-blur",
            layout === "header" &&
              "min-w-[10rem] max-w-xs sm:max-w-sm bg-card/50 text-sm",
          )}
        >
          <SelectValue placeholder="농장을 선택하세요" />
        </SelectTrigger>
        <SelectContent>
          {farms.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              <span className="truncate">{f.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
