"use client"

import * as React from "react"

import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CardDescription, CardHeader, CardTitle, Card } from "@/components/ui/card"

import type { MQTTTopic } from "@/lib/mqtt/topics"
import { cn } from "@/lib/utils"

/**
 * 액추에이터 제어 영역. LED/Pump/FAN1/FAN2를 ON/OFF 명령으로 MQTT 발행한다.
 */
export const ActuatorArea: React.FC = () => {
  type ActuatorKey = "led" | "pump" | "fan1" | "fan2"

  type ActuatorDef = {
    key: ActuatorKey
    label: string
    topic: MQTTTopic
    unit?: string
  }

  const ACTUATORS: ActuatorDef[] = React.useMemo(
    () => [
      {
        key: "led",
        label: "LED",
        topic: "smartfarm/actuators/led",
      },
      {
        key: "pump",
        label: "Pump",
        topic: "smartfarm/actuators/pump",
      },
      {
        key: "fan1",
        label: "FAN 1",
        topic: "smartfarm/actuators/fan1",
      },
      {
        key: "fan2",
        label: "FAN 2",
        topic: "smartfarm/actuators/fan2",
      },
    ],
    [],
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

  const publish = async (topic: MQTTTopic, message: string, key: ActuatorKey) => {
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
              disabled={isSending}
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
              disabled={isSending}
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
      <p className="text-sm text-muted-foreground">
        아래 버튼을 누르면 서버가 MQTT로 제어 명령(문자열 <span className="font-mono">on/off</span>)을
        발행합니다.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">{ACTUATORS.map(renderActuatorCard)}</div>
    </div>
  )
}

