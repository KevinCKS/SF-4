"use client"

import * as React from "react"

import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CardHeader, CardTitle, Card } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  AlertCircle,
  Fan,
  History,
  Lightbulb,
  Droplets,
} from "lucide-react"
import { useMqttTopicConfig } from "@/components/dashboard/useMqttTopicConfig"
import { useDashboardFarm } from "@/components/dashboard/DashboardFarmContext"
import { useMqttConnection } from "@/components/dashboard/useMqttConnection"

/** ON 상태 배지용: MQTT Connected와 같은 민트 네온 테두리·발광 */
const actuatorOnNeonBadgeClassName =
  "border border-emerald-400/60 bg-emerald-500/15 font-semibold text-emerald-100 shadow-[0_0_12px_rgba(52,211,153,0.5),0_0_4px_rgba(167,243,208,0.35)] [text-shadow:0_0_10px_rgba(167,243,208,0.45)] dark:border-emerald-400/55 dark:bg-emerald-500/18 dark:text-emerald-50 dark:shadow-[0_0_16px_rgba(52,211,153,0.48)]"

/** ON 제어 버튼용: 중간 강도 민트 네온(너무 강하지 않게 살짝만 밝게) */
const actuatorOnNeonButtonClassName =
  "border border-emerald-400/58 bg-emerald-500/22 font-semibold text-emerald-50 shadow-[0_0_11px_rgba(52,211,153,0.38),0_0_30px_rgba(16,185,129,0.17),inset_0_1px_0_rgba(255,255,255,0.1)] [text-shadow:0_0_8px_rgba(167,243,208,0.3)] hover:bg-emerald-500/29 hover:shadow-[0_0_15px_rgba(52,211,153,0.42),0_0_34px_rgba(16,185,129,0.18)] dark:border-emerald-400/52 dark:bg-emerald-500/23 dark:text-emerald-50 dark:shadow-[0_0_12px_rgba(52,211,153,0.38),0_0_32px_rgba(16,185,129,0.14)]"

/**
 * 액추에이터 제어 영역. LED/Pump/FAN1/FAN2를 ON/OFF 명령으로 MQTT 발행한다.
 */
export const ActuatorArea: React.FC = () => {
  type ActuatorKey = "led" | "pump" | "fan1" | "fan2"

  /** 액추에이터 종류별 대표 아이콘. */
  const ACTUATOR_ICONS: Record<
    ActuatorKey,
    React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  > = {
    led: Lightbulb,
    pump: Droplets,
    fan1: Fan,
    fan2: Fan,
  }

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
    lastError,
    isStatusLoading,
  } = useMqttConnection()

  type CommandLogRow = {
    id: string
    actuator_key: string
    topic: string
    payload: string
    created_at: string
  }

  const [commandLogs, setCommandLogs] = React.useState<CommandLogRow[]>([])
  const [logsLoading, setLogsLoading] = React.useState(false)
  const [logsError, setLogsError] = React.useState<string | null>(null)

  const actuatorLabel = (key: string): string =>
    ACTUATOR_META.find((m) => m.key === key)?.label ?? key

  const fetchCommandLogs = React.useCallback(async () => {
    if (!selectedFarmId) {
      setCommandLogs([])
      return
    }
    setLogsLoading(true)
    setLogsError(null)
    try {
      const res = await fetch(
        `/api/actuator-commands?farmId=${encodeURIComponent(selectedFarmId)}&limit=20`,
        { credentials: "include", cache: "no-store" },
      )
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        logs?: CommandLogRow[]
      }
      if (!res.ok) {
        setLogsError(json.error ?? "제어 이력을 불러오지 못했습니다.")
        setCommandLogs([])
        return
      }
      setCommandLogs(Array.isArray(json.logs) ? json.logs : [])
    } catch (e) {
      setLogsError(e instanceof Error ? e.message : "제어 이력 조회 오류")
      setCommandLogs([])
    } finally {
      setLogsLoading(false)
    }
  }, [selectedFarmId])

  React.useEffect(() => {
    void fetchCommandLogs()
  }, [fetchCommandLogs])

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
        body: JSON.stringify({
          topic,
          message,
          ...(selectedFarmId
            ? { farmId: selectedFarmId, actuatorKey: key }
            : {}),
        }),
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
      if (selectedFarmId) void fetchCommandLogs()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "MQTT 발행 중 오류가 발생했습니다.")
    } finally {
      setSendingKey(null)
    }
  }

  const renderActuatorCard = (a: ActuatorDef) => {
    const ActuatorIcon = ACTUATOR_ICONS[a.key]
    const s = lastState[a.key]
    const isSending = sendingKey === a.key

    const stateLabel = s === null ? "미설정" : s === "on" ? "ON" : "OFF"
    const isOn = s === "on"
    const isOff = s === "off"

    return (
      <Card
        key={a.key}
        className="border-border/80 bg-card/85 shadow-md shadow-black/25 ring-1 ring-white/10 backdrop-blur-md"
      >
        <CardHeader className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <ActuatorIcon
                  className="size-7 shrink-0 text-primary/90"
                  aria-hidden
                />
                {a.label}
              </CardTitle>
            </div>
            <Badge
              className={cn(
                "min-w-[3.5rem] justify-center whitespace-nowrap text-xs",
                s === "on" && actuatorOnNeonBadgeClassName,
              )}
              variant={s === "on" ? "outline" : s === "off" ? "secondary" : "outline"}
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
              variant="outline"
              disabled={isSending || !connected}
              onClick={() => void publish(a.topic, "on", a.key)}
              className={cn(
                "h-11 rounded-xl px-3 text-lg whitespace-nowrap transition-[color,box-shadow,background-color,border-color]",
                isOn
                  ? actuatorOnNeonButtonClassName
                  : "border-border/60 bg-transparent font-semibold text-muted-foreground hover:bg-muted/40",
              )}
            >
              ON
            </Button>
            <Button
              variant={isOff ? "secondary" : "outline"}
              disabled={isSending || !connected}
              onClick={() => void publish(a.topic, "off", a.key)}
              className={cn(
                "h-11 rounded-xl px-3 text-lg font-semibold whitespace-nowrap transition-colors",
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
    <div className="space-y-5">
      {isStatusLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-[180px]" />
            <Skeleton className="h-[180px]" />
          </div>
        </div>
      ) : null}

      {!isStatusLoading && connected && lastError ? (
        <Alert variant="destructive" className="px-3 py-3 text-lg">
          <AlertCircle className="size-5" aria-hidden />
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{lastError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
        {ACTUATORS.map(renderActuatorCard)}
      </div>

      {selectedFarmId ? (
        <div className="rounded-xl border border-border/80 bg-card/85 p-4 shadow-md shadow-black/25 ring-1 ring-white/10 backdrop-blur-md sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-base font-semibold tracking-tight">
            <History className="size-4 shrink-0 text-primary" aria-hidden />
            최근 제어 이력
            <span className="text-xs font-normal text-muted-foreground">
              (최대 20건 · 서버에 기록된 성공 발행만)
            </span>
          </div>
          {logsLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : logsError ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertTitle>이력 조회 오류</AlertTitle>
              <AlertDescription className="text-sm">
                {logsError}
                {/actuator_command_logs|relation|does not exist/i.test(logsError)
                  ? " Supabase에서 docs/sql/7.6_actuator_command_logs.sql 을 실행했는지 확인해 주세요."
                  : null}
              </AlertDescription>
            </Alert>
          ) : commandLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              아직 서버에 저장된 제어 기록이 없습니다. ON/OFF 발행이 성공하면 여기에 표시됩니다.
            </p>
          ) : (
            <div className="max-h-[280px] overflow-auto rounded-md border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[10rem] whitespace-nowrap">시각</TableHead>
                    <TableHead className="w-[5.5rem]">장치</TableHead>
                    <TableHead className="w-[3.5rem]">명령</TableHead>
                    <TableHead>토픽</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commandLogs.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-[0.9rem] tabular-nums leading-snug text-muted-foreground">
                        {new Date(row.created_at).toLocaleString("ko-KR", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {actuatorLabel(row.actuator_key)}
                      </TableCell>
                      <TableCell className="text-sm font-medium uppercase">
                        {row.payload}
                      </TableCell>
                      <TableCell
                        className="max-w-[12rem] truncate text-[0.9rem] leading-snug text-muted-foreground"
                        title={row.topic}
                      >
                        {row.topic}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

