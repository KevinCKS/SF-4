"use client"

import * as React from "react"

import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CardDescription, CardHeader, CardTitle, Card } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { mqttTopicPillButtonClassName } from "@/components/dashboard/mqttTopicPillButtonClass"
import { cn } from "@/lib/utils"
import { useMqttTopicConfig } from "@/components/dashboard/useMqttTopicConfig"
import { useDashboardFarm } from "@/components/dashboard/DashboardFarmContext"
import { useMqttConnection } from "@/components/dashboard/useMqttConnection"

export type ActuatorAreaProps = {
  /** MQTT 미연결 시 토픽 설정 시트를 연다(브로커 연결·구독은 시트 내 단일 버튼으로 수행). */
  onOpenMqttTopicSettings?: () => void
}

/**
 * 액추에이터 제어 영역. LED/Pump/FAN1/FAN2를 ON/OFF 명령으로 MQTT 발행한다.
 */
export const ActuatorArea: React.FC<ActuatorAreaProps> = ({
  onOpenMqttTopicSettings,
}) => {
  type ActuatorKey = "led" | "pump" | "fan1" | "fan2"

  type ActuatorDef = {
    key: ActuatorKey
    label: string
    topic: string
  }

  const { selectedFarmId } = useDashboardFarm()
  const config = useMqttTopicConfig(selectedFarmId)

  const ACTUATOR_META = React.useMemo(
    () => [
      {
        key: "led",
        label: "LED",
      },
      {
        key: "pump",
        label: "Pump",
      },
      {
        key: "fan1",
        label: "FAN 1",
      },
      {
        key: "fan2",
        label: "FAN 2",
      },
    ] as const,
    [],
  )

  const ACTUATORS: ActuatorDef[] = React.useMemo(
    () =>
      ACTUATOR_META.map((m) => ({
        ...m,
        topic: config.actuators[m.key],
      })),
    [ACTUATOR_META, config.actuators],
  )

  const [sendingKey, setSendingKey] = React.useState<ActuatorKey | null>(null)
  const [lastState, setLastState] = React.useState<
    Record<ActuatorKey, "on" | "off" | null>
  >({
    led: null,
    pump: null,
    fan1: null,
    fan2: null,
  })

  const {
    connected,
    envConfigured,
    lastError,
    isStatusLoading,
  } = useMqttConnection()

  const publish = async (topic: string, message: string, key: ActuatorKey) => {
    if (!connected) {
      toast.error(
        "[MQTT 토픽 설정]에서 ‘브로커 연결 및 토픽 구독’을 먼저 실행해 주세요.",
      )
      return
    }
    setSendingKey(key)
    try {
      const res = await fetch("/api/mqtt/publish", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, message }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof (json as { details?: string }).details === "string"
            ? (json as { details: string }).details
            : typeof (json as { error?: string }).error === "string"
              ? (json as { error: string }).error
              : "MQTT 발행에 실패했습니다."
        toast.error(msg)
        return
      }

      setLastState((prev) => ({ ...prev, [key]: message === "on" ? "on" : "off" }))
      toast.success(`${key.toUpperCase()} ${message.toUpperCase()} 발행 완료`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "MQTT 발행 중 오류가 발생했습니다.")
    } finally {
      setSendingKey(null)
    }
  }

  const renderActuatorCard = (a: ActuatorDef) => {
    const s = lastState[a.key]
    const isSending = sendingKey === a.key

    const stateLabel = s === null ? "미설정" : s === "on" ? "ON" : "OFF"
    const isOn = s === "on"
    const isOff = s === "off"

    return (
      <Card key={a.key} className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">{a.label}</CardTitle>
              <CardDescription className="text-xs min-h-5 leading-5">
                토픽:{" "}
                <span className="font-mono whitespace-nowrap overflow-hidden text-ellipsis align-middle">
                  {a.topic}
                </span>
              </CardDescription>
            </div>
            <Badge
              className="min-w-[3.5rem] justify-center whitespace-nowrap"
              variant={s === "on" ? "default" : s === "off" ? "secondary" : "outline"}
            >
              {stateLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {/* 상태 + 버튼을 한 줄로 합친다:
              - 현재 state에 맞는 버튼만 하이라이트한다.
              - 별도의 상태 토글바를 제거해서 2줄 레이아웃을 방지한다. */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={isOn ? "default" : "outline"}
              disabled={isSending || !connected}
              onClick={() => void publish(a.topic, "on", a.key)}
              className={cn(
                "h-10 rounded-xl px-2 text-xs font-semibold whitespace-nowrap transition-colors",
                isOn
                  ? "border-primary/60 shadow-[0_0_0_1px_rgba(16,185,129,0.55),0_14px_36px_-22px_rgba(52,211,153,0.9)]"
                  : "bg-transparent text-muted-foreground hover:bg-muted/40",
              )}
            >
              ON
            </Button>
            <Button
              variant={isOff ? "secondary" : "outline"}
              disabled={isSending || !connected}
              onClick={() => void publish(a.topic, "off", a.key)}
              className={cn(
                "h-10 rounded-xl px-2 text-xs font-semibold whitespace-nowrap transition-colors",
                isOff
                  ? "border-secondary/70 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
                  : "bg-transparent text-muted-foreground hover:bg-muted/40",
              )}
            >
              OFF
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {isStatusLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-[180px]" />
            <Skeleton className="h-[180px]" />
          </div>
        </div>
      ) : !connected ? (
        <Alert>
          <AlertTitle>MQTT 연결 필요</AlertTitle>
          <AlertDescription>
            {envConfigured === false
              ? "환경 변수에 MQTT 브로커 정보가 설정되지 않았습니다."
              : "우측 상단 [MQTT 토픽 설정]에서 ‘브로커 연결 및 토픽 구독’으로 연결한 뒤에만 액추에이터 제어 버튼을 사용할 수 있습니다."}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className={mqttTopicPillButtonClassName}
                onClick={() => onOpenMqttTopicSettings?.()}
                disabled={!onOpenMqttTopicSettings}
              >
                MQTT 토픽 설정 열기
              </Button>
              <Button variant="secondary" asChild>
                <a href="/dashboard/mqtt-test">MQTT 테스트 화면</a>
              </Button>
            </div>
            {lastError ? <p className="mt-3 text-sm text-destructive">{lastError}</p> : null}
          </AlertDescription>
        </Alert>
      ) : lastError ? (
        <Alert variant="destructive">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{lastError}</AlertDescription>
        </Alert>
      ) : (
        <p className="text-sm text-muted-foreground">
          아래 버튼을 누르면 서버가 MQTT로 제어 명령(문자열{" "}
          <span className="font-mono">on/off</span>)을 발행합니다.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">{ACTUATORS.map(renderActuatorCard)}</div>
    </div>
  )
}

