"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

import { ChartContainer, ChartTooltipContent, ChartTooltip } from "@/components/ui/chart"

import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { AlertSettingsCard } from "@/components/dashboard/AlertSettingsCard"
import { SENSOR_SECTION_SURFACE_CLASS } from "@/components/dashboard/sensorSectionSurface"
import { useMqttTopicConfig } from "@/components/dashboard/useMqttTopicConfig"
import { useDashboardFarm } from "@/components/dashboard/DashboardFarmContext"
import { useMqttConnection } from "@/components/dashboard/useMqttConnection"
import { cn } from "@/lib/utils"
import {
  Activity,
  AlertCircle,
  Antenna,
  Bot,
  Clock,
  Filter,
  Inbox,
  LineChart as LineChartIcon,
  ListOrdered,
  TestTube,
  Thermometer,
  Droplets,
} from "lucide-react"

/**
 * 센서 영역. 온도/습도/EC/pH의 현재 게이지와 최근 시계열(라인 차트)을 표시한다.
 */
const SensorArea: React.FC = () => {
  type SensorKey = "temperature" | "humidity" | "ec" | "ph"

  /** 센서 종류별 대표 아이콘(게이지·차트 카드 헤더에 사용). */
  const SENSOR_ICONS: Record<
    SensorKey,
    React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  > = {
    temperature: Thermometer,
    humidity: Droplets,
    ec: Activity,
    ph: TestTube,
  }

  type SensorDef = {
    key: SensorKey
    topic: string
    label: string
    unit: string
    color: string
    min: number
    max: number
  }

  const { selectedFarmId, selectedFarm } = useDashboardFarm()
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
  const [dailySummary, setDailySummary] = React.useState<string | null>(null)
  const [dailySummaryError, setDailySummaryError] = React.useState<string | null>(null)
  const [dailySummaryLoading, setDailySummaryLoading] = React.useState(false)
  const [dailySummaryMeta, setDailySummaryMeta] = React.useState<{
    dateKst?: string
    readingsCount?: number
    thresholdExceededTotal?: number
  } | null>(null)
  const isFetchingMessagesRef = React.useRef(false)

  // 상태 조회/연결은 useMqttConnection 훅에서 공통 처리한다.

  /**
   * MQTT 수신 로그를 서버에서 가져와 차트/게이지에 반영한다.
   * @param options.silent - true 이면 로딩 플래그를 켜지 않음(주기 폴링 시 UI 깜박임 방지)
   */
  const fetchMessages = React.useCallback(async (options?: { silent?: boolean }) => {
    if (isFetchingMessagesRef.current) return
    isFetchingMessagesRef.current = true
    const silent = options?.silent === true
    if (!silent) {
      setIsMessagesLoading(true)
      setLastError(null)
    }
    try {
      const res = await fetch("/api/mqtt/messages", {
        credentials: "include",
        cache: "no-store",
        signal:
          typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
            ? AbortSignal.timeout(4_000)
            : undefined,
      })
      if (!res.ok) {
        if (res.status === 401) {
          setLastError(
            "로그인 세션이 만료되었습니다. 새로고침하거나 다시 로그인해 주세요.",
          )
          return
        }
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
      for (const s of SENSOR_DEFS) {
        topicToKey.set(s.topic, s.key)
      }
      const inferSensorKeyFromTopic = (topic: string): SensorKey | null => {
        if (/\/sensors\/temperature$/i.test(topic)) return "temperature"
        if (/\/sensors\/humidity$/i.test(topic)) return "humidity"
        if (/\/sensors\/ec$/i.test(topic)) return "ec"
        if (/\/sensors\/ph$/i.test(topic)) return "ph"
        return null
      }

      for (const msg of raw) {
        const key = topicToKey.get(msg.topic) ?? inferSensorKeyFromTopic(msg.topic)
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
      const aborted =
        e instanceof DOMException
          ? e.name === "AbortError"
          : e instanceof Error &&
            (e.name === "AbortError" || /aborted|timeout|timed out/i.test(e.message))
      setLastError(
        aborted
          ? "센서 데이터 조회가 지연되고 있습니다. 잠시 후 자동으로 다시 시도합니다."
          : e instanceof Error
            ? e.message
            : "MQTT 수신 처리 중 오류가 발생했습니다.",
      )
    } finally {
      isFetchingMessagesRef.current = false
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

  React.useEffect(() => {
    setDailySummary(null)
    setDailySummaryError(null)
    setDailySummaryMeta(null)
  }, [selectedFarmId])

  /**
   * 선택한 농장의 당일 센서 데이터를 기반으로 AI 일일 요약을 생성한다.
   */
  const generateDailySummary = React.useCallback(async () => {
    if (!selectedFarmId) {
      setDailySummaryError("농장을 먼저 선택해 주세요.")
      return
    }
    setDailySummaryLoading(true)
    setDailySummaryError(null)
    try {
      const res = await fetch("/api/ai/daily-summary", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmId: selectedFarmId }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        summary?: string
        dateKst?: string
        readingsCount?: number
        thresholdExceededTotal?: number
      }
      if (!res.ok) {
        setDailySummaryError(json.error ?? "AI 일일 요약 생성에 실패했습니다.")
        return
      }
      setDailySummary(json.summary ?? "요약 결과가 비어 있습니다.")
      setDailySummaryMeta({
        dateKst: json.dateKst,
        readingsCount: json.readingsCount,
        thresholdExceededTotal: json.thresholdExceededTotal,
      })
    } catch (e) {
      setDailySummaryError(
        e instanceof Error ? e.message : "AI 일일 요약 생성 중 오류가 발생했습니다.",
      )
    } finally {
      setDailySummaryLoading(false)
    }
  }, [selectedFarmId])

  /**
   * 게이지 카드에 표시할 측정값 문자열(소수 둘째 자리 고정).
   */
  const formatGaugeValueText = (v: number | null, unit: string): string =>
    v === null ? "--" : `${v.toFixed(2)}${unit}`

  /**
   * 프로그래스바 양 끝에 붙이는 스케일 끝값(단위 포함).
   */
  const formatRangeEndLabel = (n: number, unit: string): string =>
    unit ? `${n}${unit}` : String(n)

  const renderGaugeCard = (s: SensorDef) => {
    const SensorIcon = SENSOR_ICONS[s.key]
    const value = latestValues[s.key]
    const showValue = value ?? null

    const percent =
      showValue === null
        ? 0
        : Math.max(0, Math.min(100, ((showValue - s.min) / (s.max - s.min)) * 100))

    return (
      <div
        key={s.key}
        className="[container-type:inline-size] overflow-hidden rounded-xl border border-border/80 bg-card/85 p-4 shadow-md shadow-black/25 ring-1 ring-white/10 backdrop-blur-md sm:p-5"
      >
        <div className="flex items-center gap-2">
          <SensorIcon
            className="size-[clamp(1.75rem,10cqi,2.25rem)] shrink-0 text-primary/90"
            aria-hidden
          />
          <span className="whitespace-nowrap break-keep text-[clamp(1.5rem,12cqi,2.5rem)] font-semibold leading-none tracking-tight text-foreground">
            {s.label}
          </span>
        </div>
        {/* 측정값: 카드 너비(cqi)에 맞춰 한 줄에서 가능한 한 크게 */}
        <p
          className={cn(
            "mt-2 block w-full whitespace-nowrap text-[clamp(0.86rem,18cqi,3.15rem)] font-bold tabular-nums tracking-tight leading-none",
            showValue === null && "font-semibold text-muted-foreground",
          )}
          style={
            showValue !== null
              ? {
                  backgroundImage: `linear-gradient(180deg, #f0fdf4 0%, ${s.color} 48%, color-mix(in srgb, ${s.color} 70%, #020617) 100%)`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  WebkitTextFillColor: "transparent",
                }
              : undefined
          }
        >
          {formatGaugeValueText(showValue, s.unit)}
        </p>
        <div className="mt-3 space-y-1">
          <div className="flex justify-between gap-2 px-0.5 text-[10px] tabular-nums leading-none text-muted-foreground">
            <span className="min-w-0 shrink truncate">
              {formatRangeEndLabel(s.min, s.unit)}
            </span>
            <span className="min-w-0 shrink truncate text-right">
              {formatRangeEndLabel(s.max, s.unit)}
            </span>
          </div>
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
     * 현재값(마지막 포인트)에만 위쪽을 가리키는 삼각형을 렌더한다.
     * MQTT Connected 배지와 같은 민트·네온 느낌을 위해 SVG 필터(가우시안 블러 머지)로 외곽 발광을 준다.
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

      // (cx, cy)를 기준으로 위로 향하는 삼각형. y는 아래로 증가하므로 위 꼭짓점은 yTop.
      const w = 12
      const h = 16
      const x1 = cx - w / 2
      const x2 = cx + w / 2
      const yBase = cy + 8
      const yTop = cy - h

      const points = `${x1},${yBase} ${x2},${yBase} ${cx},${yTop}`
      const neonFilterId = `sensor-triangle-neon-${s.key}`

      return (
        <g key={`sensor-dot-triangle-${index}`}>
          <defs>
            <filter
              id={neonFilterId}
              x="-120%"
              y="-120%"
              width="340%"
              height="340%"
              colorInterpolationFilters="sRGB"
            >
              {/* 넓은 발광 + 좁은 발광 + 원형을 겹쳐 네온 사인 느낌 */}
              <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="bloom" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="glow" />
              <feMerge>
                <feMergeNode in="bloom" />
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g filter={`url(#${neonFilterId})`}>
            <polygon
              points={points}
              fill={s.color}
              stroke="rgba(236, 253, 245, 0.92)"
              strokeWidth={1.35}
              strokeLinejoin="round"
            />
          </g>
        </g>
      )
    }

    return (
      <div
        key={s.key}
        className="rounded-xl border border-border/80 bg-card/85 p-4 shadow-md shadow-black/25 ring-1 ring-white/10 backdrop-blur-md"
      >
        <p className="mb-2 flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
          <LineChartIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span>
            {s.label}{" "}
            <span className="font-medium text-muted-foreground">· 최근 추이</span>
          </span>
        </p>
        <ChartContainer
          id={`sensor-${s.key}`}
          config={{ value: { label: `${s.label}`, color: s.color } }}
          className="h-[168px] text-xs [&_.recharts-cartesian-axis-tick_text]:text-[12px]"
        >
          <LineChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="ts"
            type="number"
            domain={["auto", "auto"]}
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => {
              const d = new Date(v)
              // 24시간제(오전/오후 문구 없음)
              return d.toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })
            }}
          />
          <YAxis
            domain={["auto", "auto"]}
            width={36}
            tick={{ fontSize: 12 }}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                indicator="dot"
                hideLabel
                className="text-xs"
              />
            }
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
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isStatusLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-[140px]" />
            <Skeleton className="h-[140px]" />
          </div>
        </div>
      ) : null}

      {connected && !isMessagesLoading && !lastError ? (
        (() => {
          const hasAnyData = Object.values(series).some((pts) => pts.length > 0)
          if (!hasAnyData) {
            return (
              <Alert className="px-3 py-3 text-lg">
                <Inbox className="size-5" aria-hidden />
                <AlertTitle>데이터 없음</AlertTitle>
                <AlertDescription>
                  아직 MQTT에서 센서 데이터를 수신하지 못했습니다.
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Button variant="secondary" asChild>
                      <a
                        href="/dashboard/mqtt-test"
                        className="inline-flex items-center gap-2"
                      >
                        <Antenna className="size-4 shrink-0" aria-hidden />
                        MQTT 테스트 화면
                      </a>
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
        <Alert variant="destructive" className="px-3 py-3 text-lg">
          <AlertCircle className="size-5" aria-hidden />
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{lastError}</AlertDescription>
        </Alert>
      ) : null}

      {/* 게이지 값 → 표시 범위 → 추이 차트 → 알림 임계치 → AI 요약 */}
      <div className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {SENSOR_DEFS.map((s) => renderGaugeCard(s))}
        </div>

        <div className={SENSOR_SECTION_SURFACE_CLASS}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <Label className="flex min-w-0 items-center gap-2 text-base font-semibold tracking-tight text-foreground">
              <Filter className="size-4 shrink-0 text-primary" aria-hidden />
              차트·게이지 표시 범위
            </Label>
            <p className="text-xs text-muted-foreground sm:text-right">
              시간 창을 먼저 적용한 뒤, 그 안에서 최근 N개만 표시합니다.
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="min-w-[12rem] sm:max-w-[14rem]">
              <Select
                value={String(minutesToShow)}
                onValueChange={(v) => setMinutesToShow(Number(v))}
              >
                <SelectTrigger className="h-9 min-h-9 gap-2 text-sm">
                  <Clock className="size-3.5 shrink-0 opacity-70" aria-hidden />
                  <SelectValue placeholder="최근 N분" />
                </SelectTrigger>
                <SelectContent className="text-sm">
                  <SelectItem value="5">최근 5분</SelectItem>
                  <SelectItem value="10">최근 10분</SelectItem>
                  <SelectItem value="20">최근 20분</SelectItem>
                  <SelectItem value="30">최근 30분</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[12rem] sm:max-w-[14rem]">
              <Select
                value={String(pointsToShow)}
                onValueChange={(v) => setPointsToShow(Number(v))}
              >
                <SelectTrigger className="h-9 min-h-9 gap-2 text-sm">
                  <ListOrdered
                    className="size-3.5 shrink-0 opacity-70"
                    aria-hidden
                  />
                  <SelectValue placeholder="최근 N개" />
                </SelectTrigger>
                <SelectContent className="text-sm">
                  <SelectItem value="30">최근 30개</SelectItem>
                  <SelectItem value="60">최근 60개</SelectItem>
                  <SelectItem value="80">최근 80개</SelectItem>
                  <SelectItem value="120">최근 120개</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {SENSOR_DEFS.map((s) => renderMiniChart(s))}
        </div>

        <AlertSettingsCard />

        <div className={SENSOR_SECTION_SURFACE_CLASS}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
                <Bot className="size-4 shrink-0 text-primary" aria-hidden />
                AI 일일 요약
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedFarm?.name
                  ? `${selectedFarm.name}의 당일 sensor_readings를 기반으로 요약합니다.`
                  : "농장을 선택하면 당일 요약을 생성할 수 있습니다."}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="shrink-0"
              onClick={() => void generateDailySummary()}
              disabled={!selectedFarmId || dailySummaryLoading}
            >
              {dailySummaryLoading ? "요약 생성 중..." : "AI 요약 생성"}
            </Button>
          </div>

          {dailySummaryError ? (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="size-4" aria-hidden />
              <AlertTitle>AI 요약 오류</AlertTitle>
              <AlertDescription>{dailySummaryError}</AlertDescription>
            </Alert>
          ) : null}

          {dailySummary ? (
            <div className="mt-4 space-y-2">
              <div className="text-xs text-muted-foreground">
                {dailySummaryMeta?.dateKst ? `기준일(KST): ${dailySummaryMeta.dateKst}` : null}
                {typeof dailySummaryMeta?.readingsCount === "number"
                  ? ` · 측정 ${dailySummaryMeta.readingsCount}건`
                  : null}
                {typeof dailySummaryMeta?.thresholdExceededTotal === "number"
                  ? ` · 임계치 초과 ${dailySummaryMeta.thresholdExceededTotal}건`
                  : null}
              </div>
              <Textarea
                value={dailySummary}
                readOnly
                className="min-h-24 resize-y bg-background/40 text-sm leading-relaxed"
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default SensorArea

