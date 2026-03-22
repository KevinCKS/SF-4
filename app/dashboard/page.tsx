"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"

import { useDashboardFarm } from "@/components/dashboard/DashboardFarmContext"
import { useMqttConnection } from "@/components/dashboard/useMqttConnection"
import { MqttTopicConfigurator } from "@/components/dashboard/MqttTopicConfigurator"
import { mqttTopicPillButtonClassName } from "@/components/dashboard/mqttTopicPillButtonClass"
import SensorArea from "@/components/dashboard/SensorArea"
import { ActuatorArea } from "@/components/dashboard/ActuatorArea"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { badgeVariants } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { getMqttTopicConfig, getSubscribeTopicsFromConfig } from "@/lib/mqtt/topicConfig"
import { isAllowedMqttTopic } from "@/lib/mqtt/topics"
import { cn } from "@/lib/utils"

/**
 * 대시보드 메인: 센서 영역과 액추에이터 영역 레이아웃.
 */
const DashboardPage: React.FC = () => {
  const { isLoading, error, farms, selectedFarmId } = useDashboardFarm()
  const {
    connected,
    envConfigured,
    isStatusLoading,
    isConnecting,
    isDisconnecting,
    connect,
    disconnect,
  } = useMqttConnection()
  const [topicSheetOpen, setTopicSheetOpen] = React.useState(false)
  const [topicSheetWidth, setTopicSheetWidth] = React.useState(() => {
    if (typeof window === "undefined") return 560
    return Math.min(560, Math.max(360, Math.floor(window.innerWidth * 0.9)))
  })

  React.useEffect(() => {
    const clamp = () => {
      const max = Math.max(360, Math.floor(window.innerWidth * 0.9))
      setTopicSheetWidth((w) => Math.min(Math.max(w, 360), max))
    }
    clamp()
    window.addEventListener("resize", clamp)
    return () => window.removeEventListener("resize", clamp)
  }, [])

  const startDragResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const startX = e.clientX
    const startWidth = topicSheetWidth

    const onMove = (ev: PointerEvent) => {
      const delta = startX - ev.clientX
      const max = Math.max(360, Math.floor(window.innerWidth * 0.9))
      const next = Math.min(Math.max(startWidth + delta, 360), max)
      setTopicSheetWidth(next)
    }

    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp, { once: true })
  }

  const mqttToggleBusy = isConnecting || isDisconnecting

  /**
   * MQTT 상태 배지 클릭 시 연결 해제하거나,
   * 저장된 MQTT 토픽 설정(localStorage)을 즉시 읽어 브로커 연결·구독을 요청한다.
   */
  const handleMqttStatusClick = async () => {
    if (mqttToggleBusy) return
    if (connected) {
      const ok = await disconnect()
      if (ok) toast.success("MQTT 연결을 끊었습니다.")
      else toast.error("MQTT 연결 해제에 실패했습니다.")
      return
    }
    if (envConfigured === false) {
      toast.error("MQTT 환경 변수가 설정되지 않았습니다.")
      return
    }
    // React 상태가 아닌 최신 저장값을 사용한다(설정 시트 저장 직후·다른 탭 반영 등).
    const configFromStorage = getMqttTopicConfig(selectedFarmId)
    const topics = getSubscribeTopicsFromConfig(configFromStorage)
    const invalid = topics.filter((t) => !isAllowedMqttTopic(t))
    if (invalid.length > 0) {
      toast.error(`허용되지 않은 토픽이 있습니다: ${invalid[0]}`)
      return
    }
    const ok = await connect(topics)
    if (ok) toast.success("MQTT에 연결했습니다.")
    else toast.error("MQTT 연결에 실패했습니다.")
  }

  return (
    <div className="w-full px-8 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight">대시보드</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          선택한 농장의 센서와 액추에이터를 한 화면에서 확인합니다.
        </p>
        {error ? (
          <p className="text-xl text-destructive">{error}</p>
        ) : isLoading && farms.length === 0 ? (
          <Skeleton className="h-6 w-72" />
        ) : farms.length === 0 ? (
          <p className="text-xl text-muted-foreground">
            등록된 농장이 없습니다. 농장을 먼저 추가해 주세요.
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        {/* MQTT 연결 상태 배지: 클릭 시 연결/연결 해제(별도 버튼 없음) */}
        <div className="flex min-h-10 items-center">
          {isStatusLoading ? (
            <Skeleton className="h-9 min-w-[12rem] rounded-full" />
          ) : (
            <button
              type="button"
              aria-busy={mqttToggleBusy}
              aria-label={
                connected ? "MQTT 연결 끊기" : "MQTT 연결하기"
              }
              disabled={
                mqttToggleBusy ||
                (!connected && envConfigured === false)
              }
              onClick={() => void handleMqttStatusClick()}
              className={cn(
                badgeVariants({ variant: "outline" }),
                "h-9 min-h-9 gap-2 rounded-full border-2 px-4 py-1 text-sm font-semibold leading-none tracking-tight transition-[opacity,transform,box-shadow] hover:opacity-95 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50",
                connected
                  ? "cursor-pointer border-emerald-500/55 bg-emerald-500/15 text-emerald-800 shadow-sm shadow-emerald-500/10 dark:border-emerald-400/50 dark:bg-emerald-500/18 dark:text-emerald-200 dark:shadow-emerald-500/15"
                  : "cursor-pointer border-amber-500/70 bg-amber-500/20 text-amber-950 shadow-sm shadow-amber-500/15 ring-1 ring-amber-500/25 dark:border-amber-400/55 dark:bg-amber-500/22 dark:text-amber-100 dark:ring-amber-400/30",
              )}
            >
              <span
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  connected
                    ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.75)]"
                    : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.65)]",
                )}
                aria-hidden
              />
              {mqttToggleBusy
                ? isDisconnecting
                  ? "끊는 중…"
                  : "연결 중…"
                : connected
                  ? "MQTT Connected"
                  : "MQTT Disconnected"}
            </button>
          )}
        </div>

        <Sheet open={topicSheetOpen} onOpenChange={setTopicSheetOpen}>
          <SheetTrigger asChild>
            <Button type="button" className={cn(mqttTopicPillButtonClassName)}>
              MQTT 토픽 설정
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="pointer-events-auto z-[60]"
            style={{
              width: topicSheetWidth,
              maxWidth: "90vw",
              minWidth: 360,
              right: 0,
            }}
          >
            {/* 드래그로 Sheet 가로 폭을 조절한다. (오른쪽에서 열리므로 왼쪽 핸들 기준) */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="토픽 설정 패널 크기 조절"
              className="absolute left-0 top-0 z-20 h-full w-2 cursor-col-resize"
              onPointerDown={startDragResize}
            />
            <SheetHeader>
              <SheetTitle className="text-2xl">MQTT 토픽 설정</SheetTitle>
              <SheetDescription className="text-lg leading-relaxed">
                토픽을 입력한 뒤 “브로커 연결 및 토픽 구독”으로 연결과 구독을 한 번에 적용합니다.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              <MqttTopicConfigurator />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="border-border/80 bg-card/90 shadow-lg shadow-black/25 ring-1 ring-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-2xl">센서</CardTitle>
          </CardHeader>
          <CardContent>
            <SensorArea />
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/90 shadow-lg shadow-black/25 ring-1 ring-white/10 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="text-2xl">액추에이터</CardTitle>
          </CardHeader>
          <CardContent>
            <ActuatorArea />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex flex-col gap-2 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
        {/* text-lg(1.125rem) 대비 0.7배 ≈ 0.7875rem */}
        <p className="text-[0.7875rem] text-muted-foreground">
          개발·검증용 링크 (헤더 메뉴에서도 이동 가능)
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            variant="secondary"
            size="default"
            className="text-[0.7875rem]"
          >
            <Link href="/dashboard/mqtt-test">MQTT 테스트</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="default"
            className="text-[0.7875rem]"
          >
            <Link href="/dashboard/farms">농장 관리</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
