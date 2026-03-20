"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"

import { ChartContainer, ChartTooltipContent, ChartTooltip } from "@/components/ui/chart"

import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * 센서 영역. 온도/습도/EC/pH의 현재 게이지와 최근 시계열(라인 차트)을 표시한다.
 */
const SensorArea: React.FC = () => {
  type SensorKey = "temperature" | "humidity" | "ec" | "ph"

  type SensorDef = {
    key: SensorKey
    topic: string
    label: string
    unit: string
    color: string
    min: number
    max: number
  }

  const SENSOR_DEFS: SensorDef[] = React.useMemo(
    () => [
      {
        key: "temperature",
        topic: "smartfarm/sensors/temperature",
        label: "온도",
        unit: "°C",
        color: "rgb(52, 211, 153)",
        min: 0,
        max: 50,
      },
      {
        key: "humidity",
        topic: "smartfarm/sensors/humidity",
        label: "습도",
        unit: "%",
        color: "rgb(34, 197, 94)",
        min: 0,
        max: 100,
      },
      {
        key: "ec",
        topic: "smartfarm/sensors/ec",
        label: "EC",
        unit: "mS/cm",
        color: "rgb(16, 185, 129)",
        min: 0,
        max: 6,
      },
      {
        key: "ph",
        topic: "smartfarm/sensors/ph",
        label: "pH",
        unit: "",
        color: "rgb(45, 212, 191)",
        min: 0,
        max: 14,
      },
    ],
    [],
  )

  type MqttMessageLog = {
    id: string
    receivedAt: string
    topic: string
    payload: string
  }

  type Point = { ts: number; value: number }

  const parseNumericValue = (payload: string): number | null => {
    const trimmed = payload.trim()
    if (!trimmed) return null

    // 1) JSON 형태: {"value":25} / {"value":25,"unit":"..."} 등
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (typeof parsed === "number") return Number.isFinite(parsed) ? parsed : null
      if (typeof parsed !== "object" || parsed === null) return null
      const obj = parsed as Record<string, unknown>

      // 공통: value 필드
      if (typeof obj.value === "number" && Number.isFinite(obj.value)) {
        return obj.value
      }

      // 예: temperature/humidity/ec/ph 키로 들어오는 경우
      const candidates = ["temperature", "humidity", "ec", "ph", "pH", "ecValue"]
      for (const k of candidates) {
        const v = obj[k]
        if (typeof v === "number" && Number.isFinite(v)) return v
      }
    } catch {
      // 2) JSON이 아니면 숫자 문자열로 파싱 시도
    }

    const n = Number(trimmed)
    if (Number.isFinite(n)) return n

    const f = Number.parseFloat(trimmed)
    return Number.isFinite(f) ? f : null
  }

  const toTs = (iso: string): number | null => {
    const t = Date.parse(iso)
    return Number.isFinite(t) ? t : null
  }

  const [connected, setConnected] = React.useState(false)
  const [envConfigured, setEnvConfigured] = React.useState<boolean | null>(null)
  const [lastError, setLastError] = React.useState<string | null>(null)
  const [isConnecting, setIsConnecting] = React.useState(false)

  const [latestValues, setLatestValues] = React.useState<
    Record<SensorKey, number | null>
  >({
    temperature: null,
    humidity: null,
    ec: null,
    ph: null,
  })

  const [series, setSeries] = React.useState<Record<SensorKey, Point[]>>({
    temperature: [],
    humidity: [],
    ec: [],
    ph: [],
  })

  // 차트 표시 범위 옵션 (최근 N분 + 최근 N개 포인트를 동시에 반영)
  const [pointsToShow, setPointsToShow] = React.useState<number>(80)
  const [minutesToShow, setMinutesToShow] = React.useState<number>(10)

  const fetchStatus = React.useCallback(async () => {
    const res = await fetch("/api/mqtt/status", { credentials: "include", cache: "no-store" })
    if (!res.ok) {
      setConnected(false)
      setLastError(await res.text().catch(() => "상태 조회 실패"))
      return
    }
    const data = (await res.json()) as {
      connected?: boolean
      envConfigured?: boolean
      lastConnectError?: string | null
      hint?: string
    }
    setConnected(Boolean(data.connected))
    setEnvConfigured(typeof data.envConfigured === "boolean" ? data.envConfigured : null)
    setLastError(data.lastConnectError ?? data.hint ?? null)
  }, [])

  const fetchMessages = React.useCallback(async () => {
    const res = await fetch("/api/mqtt/messages", {
      credentials: "include",
      cache: "no-store",
    })
    if (!res.ok) return
    const data = (await res.json()) as { messages?: MqttMessageLog[] }
    const raw = Array.isArray(data.messages) ? data.messages : []

    const nextSeries: Record<SensorKey, Point[]> = {
      temperature: [],
      humidity: [],
      ec: [],
      ph: [],
    }

    const nextLatest: Record<SensorKey, number | null> = {
      temperature: null,
      humidity: null,
      ec: null,
      ph: null,
    }

    const topicToKey = new Map<string, SensorKey>()
    for (const s of SENSOR_DEFS) topicToKey.set(s.topic, s.key)

    for (const msg of raw) {
      const key = topicToKey.get(msg.topic)
      if (!key) continue
      const value = parseNumericValue(msg.payload)
      if (value === null) continue
      const ts = toTs(msg.receivedAt)
      if (ts === null) continue
      nextSeries[key].push({ ts, value })
    }

    // ts 기준 정렬 후 최근 N개로 제한
    const nowTs = Date.now()
    const windowStartTs = nowTs - minutesToShow * 60_000

    for (const key of Object.keys(nextSeries) as SensorKey[]) {
      let pts = nextSeries[key]
      pts.sort((a, b) => a.ts - b.ts)

      // 1) 시간 기준 필터
      pts = pts.filter((p) => p.ts >= windowStartTs)
      // 2) 포인트 개수 제한
      pts = pts.slice(-pointsToShow)

      nextSeries[key] = pts
      nextLatest[key] = pts.length > 0 ? pts[pts.length - 1]?.value ?? null : null
    }

    setSeries(nextSeries)
    setLatestValues(nextLatest)
  }, [SENSOR_DEFS, minutesToShow, pointsToShow])

  React.useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  React.useEffect(() => {
    if (!connected) return
    void fetchMessages()

    const id = window.setInterval(() => {
      void fetchMessages()
    }, 2000)
    return () => window.clearInterval(id)
  }, [connected, fetchMessages])

  // 표시 범위 설정을 바꿨을 때 즉시 반영하기 위해 한 번 갱신한다.
  React.useEffect(() => {
    if (!connected) return
    void fetchMessages()
  }, [pointsToShow, minutesToShow, connected, fetchMessages])

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      const res = await fetch("/api/mqtt/connect", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { details?: string }
        setLastError(j.details ?? "MQTT 연결 실패")
        return
      }
      await fetchStatus()
      await fetchMessages()
    } finally {
      setIsConnecting(false)
    }
  }

  const renderGaugeCard = (s: SensorDef) => {
    const value = latestValues[s.key]
    const showValue = value ?? null

    const percent =
      showValue === null
        ? 0
        : Math.max(0, Math.min(100, ((showValue - s.min) / (s.max - s.min)) * 100))

    return (
      <div
        key={s.key}
        className="rounded-xl border border-border/60 bg-card/50 p-4 backdrop-blur"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {showValue === null ? "--" : `${showValue}${s.unit}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">범위 {s.min}~{s.max}</p>
          </div>
        </div>
        <div className="mt-3">
          <Progress value={percent} aria-label={`${s.label} 게이지`} className="h-2" />
        </div>
      </div>
    )
  }

  const renderMiniChart = (s: SensorDef) => {
    // 최신이 오른쪽에 오도록 x(ts) 오름차순 정렬을 강제한다.
    const points = [...series[s.key]].sort((a, b) => a.ts - b.ts)
    const data = points.map((p) => ({ ts: p.ts, value: p.value }))

    return (
      <ChartContainer
        key={s.key}
        id={`sensor-${s.key}`}
        config={{ value: { label: `${s.label}`, color: s.color } }}
        className="h-[180px]"
      >
        <LineChart data={data} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="ts"
            type="number"
            domain={["auto", "auto"]}
            tickFormatter={(v) => {
              const d = new Date(v)
              return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
            }}
          />
          <YAxis
            domain={["auto", "auto"]}
            width={36}
          />
          <ChartTooltip
            content={<ChartTooltipContent indicator="dot" hideLabel />}
          />
          <Line dataKey="value" type="monotone" stroke={s.color} strokeWidth={2} dot={false} />
        </LineChart>
      </ChartContainer>
    )
  }

  return (
    <div className="space-y-6">
      {!connected ? (
        <Alert>
          <AlertTitle>MQTT 연결 필요</AlertTitle>
          <AlertDescription>
            {envConfigured === false
              ? "환경 변수에 MQTT 브로커 정보가 설정되지 않았습니다."
              : "브로커에 연결한 뒤 허용 토픽이 들어오면 게이지와 차트가 갱신됩니다."}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => void handleConnect()} disabled={isConnecting}>
                {isConnecting ? "연결 중…" : "브로커에 연결"}
              </Button>
              <Button variant="secondary" asChild>
                <a href="/dashboard/mqtt-test">MQTT 테스트 화면</a>
              </Button>
            </div>
            {lastError ? (
              <p className="mt-3 text-sm text-destructive">{lastError}</p>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col">
          <Label className="text-sm">필터 우선순위(시간 → 갯수)</Label>
          <p className="text-xs text-muted-foreground">
            1) 최근 <strong>{minutesToShow}분</strong> 구간을 먼저 자른 뒤,
            2) 그 안에서 최근 <strong>{pointsToShow}개</strong> 포인트만 표시합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 시간 우선 */}
          <div className="min-w-[12rem]">
            <Select
              value={String(minutesToShow)}
              onValueChange={(v) => setMinutesToShow(Number(v))}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="1단계: 최근 N분" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">최근 5분</SelectItem>
                <SelectItem value="10">최근 10분</SelectItem>
                <SelectItem value="20">최근 20분</SelectItem>
                <SelectItem value="30">최근 30분</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 갯수(최종 컷) */}
          <div className="min-w-[12rem]">
            <Select
              value={String(pointsToShow)}
              onValueChange={(v) => setPointsToShow(Number(v))}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="2단계: 최근 N개" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">최근 30개</SelectItem>
                <SelectItem value="60">최근 60개</SelectItem>
                <SelectItem value="80">최근 80개</SelectItem>
                <SelectItem value="120">최근 120개</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SENSOR_DEFS.map((s) => renderGaugeCard(s))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {SENSOR_DEFS.map((s) => renderMiniChart(s))}
      </div>
    </div>
  )
}

export default SensorArea

