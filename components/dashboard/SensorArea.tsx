"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

import { ChartContainer, ChartTooltipContent, ChartTooltip } from "@/components/ui/chart"

import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useMqttTopicConfig } from "@/components/dashboard/useMqttTopicConfig"
import { useDashboardFarm } from "@/components/dashboard/DashboardFarmContext"
import { useMqttConnection } from "@/components/dashboard/useMqttConnection"

export type SensorAreaProps = {
  /** MQTT 미연결 시 토픽 설정 시트를 연다(브로커 연결·구독은 시트 내 단일 버튼으로 수행). */
  onOpenMqttTopicSettings?: () => void
}

/**
 * 센서 영역. 온도/습도/EC/pH의 현재 게이지와 최근 시계열(라인 차트)을 표시한다.
 */
const SensorArea: React.FC<SensorAreaProps> = ({
  onOpenMqttTopicSettings,
}) => {
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

  const { selectedFarmId } = useDashboardFarm()
  const config = useMqttTopicConfig(selectedFarmId)

  const SENSOR_META = React.useMemo(
    () => [
      {
        key: "temperature",
        label: "온도",
        unit: "°C",
        color: "rgb(52, 211, 153)",
        min: 0,
        max: 50,
      },
      {
        key: "humidity",
        label: "습도",
        unit: "%",
        color: "rgb(34, 197, 94)",
        min: 0,
        max: 100,
      },
      {
        key: "ec",
        label: "EC",
        unit: "mS/cm",
        color: "rgb(16, 185, 129)",
        min: 0,
        max: 6,
      },
      {
        key: "ph",
        label: "pH",
        unit: "",
        color: "rgb(45, 212, 191)",
        min: 0,
        max: 14,
      },
    ] as const,
    [],
  )

  const SENSOR_DEFS: SensorDef[] = React.useMemo(
    () =>
      SENSOR_META.map((m) => ({
        ...m,
        topic: config.sensors[m.key],
      })),
    [SENSOR_META, config.sensors],
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

  const {
    connected,
    envConfigured,
    lastError,
    setLastError,
    isStatusLoading,
  } = useMqttConnection()
  const [isMessagesLoading, setIsMessagesLoading] = React.useState(false)

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

  // 상태 조회/연결은 useMqttConnection 훅에서 공통 처리한다.

  /**
   * MQTT 수신 로그를 서버에서 가져와 차트/게이지에 반영한다.
   * @param options.silent - true 이면 로딩 플래그를 켜지 않음(주기 폴링 시 UI 깜박임 방지)
   */
  const fetchMessages = React.useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true
    if (!silent) {
      setIsMessagesLoading(true)
      setLastError(null)
    }
    try {
      const res = await fetch("/api/mqtt/messages", {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) {
        setLastError(await res.text().catch(() => "MQTT 수신 로그 조회 실패"))
        return
      }
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

      setLastError(null)
      setSeries(nextSeries)
      setLatestValues(nextLatest)
    } catch (e) {
      setLastError(e instanceof Error ? e.message : "MQTT 수신 처리 중 오류가 발생했습니다.")
    } finally {
      if (!silent) {
        setIsMessagesLoading(false)
      }
    }
  }, [SENSOR_DEFS, minutesToShow, pointsToShow, setLastError])

  // 토픽 설정 변경 시 상태 갱신은 useMqttConnection 훅에서 자동 처리한다.

  React.useEffect(() => {
    if (!connected) return
    void fetchMessages({ silent: true })

    const id = window.setInterval(() => {
      void fetchMessages({ silent: true })
    }, 2000)
    return () => window.clearInterval(id)
  }, [connected, fetchMessages])

  // 표시 범위 설정을 바꿨을 때 즉시 반영하기 위해 한 번 갱신한다.
  React.useEffect(() => {
    if (!connected) return
    void fetchMessages({ silent: true })
  }, [pointsToShow, minutesToShow, connected, fetchMessages])

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

    /**
     * 현재값(마지막 포인트)에만 삼각형 화살표를 렌더한다.
     * 시각적 “입체감”을 위해 한 겹 더 아래로 어두운 폴리곤을 겹친다.
     */
    const CurrentValueTriangleDot = (props: {
      cx?: number
      cy?: number
      index?: number
      value?: number
    }) => {
      const { cx, cy, index } = props
      if (typeof cx !== "number" || typeof cy !== "number" || typeof index !== "number") {
        return <g key={`sensor-dot-skip-${String(index)}`} />
      }
      if (index !== data.length - 1) {
        return <g key={`sensor-dot-hide-${index}`} />
      }

      // (cx, cy)를 기준으로 위로 향하는 삼각형(화살표)을 그린다.
      // 좌표계 특성상 y가 아래로 증가하므로 cy-쪽이 “위”가 된다.
      const w = 12 // 가로 폭(전체 크기 축소)
      const h = 16 // 높이(전체 크기 축소)
      const x1 = cx - w / 2
      const x2 = cx + w / 2
      // 아래쪽(메인 삼각형)의 베이스를 살짝 줄여 “아래 삼각형”을 더 작게 느끼도록 한다.
      const yBase = cy + 8
      const yTop = cy - h

      // 입체감:
      // - 그림자를 2~3겹(깊은 그림자 + 중간 그림자 + 얕은 글로우)
      // - 테두리(링)로 “두드러짐”
      // - 위쪽 하이라이트로 “현대적인 광택” 느낌
      const deepShadowOffset = 2.3
      const midShadowOffset = 1.2
      const glowOffset = 0.8

      const deepShadowTop = yTop + deepShadowOffset
      const deepShadowBase = yBase + deepShadowOffset
      const midShadowTop = yTop + midShadowOffset
      const midShadowBase = yBase + midShadowOffset
      const glowTop = yTop + glowOffset
      const glowBase = yBase + glowOffset

      // 외곽 “링” (살짝 더 크게)
      const ringW = w * 1.04
      const ringH = h * 0.95
      const ringX1 = cx - ringW / 2
      const ringX2 = cx + ringW / 2
      const ringYBase = yBase + 0.5
      const ringYTop = yTop - (ringH - h) / 2

      // 하이라이트(위쪽 광택)
      // 위쪽(하이라이트) 삼각형을 “조금 더 크게”
      const hiW = w * 0.60
      const hiH = h * 0.40
      const hiX1 = cx - hiW / 2
      const hiX2 = cx + hiW / 2
      const hiYBase = yTop + hiH * 0.88
      const hiYTop = yTop - hiH * 0.18

      return (
        <g key={`sensor-dot-triangle-${index}`}>
          <polygon
            key="deep-shadow"
            points={`${x1},${deepShadowBase} ${x2},${deepShadowBase} ${cx},${deepShadowTop}`}
            fill="rgba(0,0,0,0.40)"
          />
          <polygon
            key="mid-shadow"
            points={`${x1},${midShadowBase} ${x2},${midShadowBase} ${cx},${midShadowTop}`}
            fill="rgba(0,0,0,0.22)"
          />
          {/* 살짝 아래에 깔린 글로우 레이어 */}
          <polygon
            key="glow"
            points={`${x1},${glowBase} ${x2},${glowBase} ${cx},${glowTop}`}
            fill="rgba(255,255,255,0.12)"
          />

          {/* 외곽 링 */}
          <polygon
            key="ring"
            points={`${ringX1},${ringYBase} ${ringX2},${ringYBase} ${cx},${ringYTop}`}
            fill="rgba(0,0,0,0)"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={1.0}
          />

          <polygon
            key="main"
            points={`${x1},${yBase} ${x2},${yBase} ${cx},${yTop}`}
            fill={s.color}
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={1.2}
          />
          <polygon
            key="highlight"
            points={`${hiX1},${hiYBase} ${hiX2},${hiYBase} ${cx},${hiYTop}`}
            fill="rgba(255,255,255,0.38)"
          />
        </g>
      )
    }

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
          <Line
            dataKey="value"
            type="monotone"
            stroke={s.color}
            strokeWidth={2}
            dot={CurrentValueTriangleDot}
            activeDot={false}
          />
        </LineChart>
      </ChartContainer>
    )
  }

  return (
    <div className="space-y-6">
      {isStatusLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-[140px]" />
            <Skeleton className="h-[140px]" />
          </div>
        </div>
      ) : null}

      {!isStatusLoading && !connected ? (
        <Alert>
          <AlertTitle>MQTT 연결 필요</AlertTitle>
          <AlertDescription>
            {envConfigured === false
              ? "환경 변수에 MQTT 브로커 정보가 설정되지 않았습니다."
              : "우측 상단 [MQTT 토픽 설정]에서 토픽을 확인한 뒤, ‘브로커 연결 및 토픽 구독’ 버튼으로 연결과 구독을 한 번에 적용하세요. 메시지가 들어오면 게이지와 차트가 갱신됩니다."}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
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
      ) : null}

      {connected && !isMessagesLoading && !lastError ? (
        (() => {
          const hasAnyData = Object.values(series).some((pts) => pts.length > 0)
          if (!hasAnyData) {
            return (
              <Alert>
                <AlertTitle>데이터 없음</AlertTitle>
                <AlertDescription>
                  아직 MQTT에서 센서 데이터를 수신하지 못했습니다.
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Button variant="secondary" asChild>
                      <a href="/dashboard/mqtt-test">MQTT 테스트 화면</a>
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )
          }
          return null
        })()
      ) : null}

      {connected && lastError && !isStatusLoading ? (
        <Alert variant="destructive">
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{lastError}</AlertDescription>
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

