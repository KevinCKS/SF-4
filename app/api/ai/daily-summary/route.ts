import { generateText } from "ai"
import { NextResponse } from "next/server"

import { getGeminiModel, normalizeGeminiErrorMessage } from "@/lib/ai/gemini"
import { isRequireUserSuccess, requireUser } from "@/lib/api/server"

export const dynamic = "force-dynamic"

type DailySummaryBody = {
  farmId?: string
}

type SensorRow = {
  id: string
  name: string | null
  sensor_type: string | null
  unit: string | null
}

type ReadingRow = {
  sensor_id: string
  value: number
  recorded_at: string
}

type SensorStats = {
  sensorType: string
  count: number
  min: number
  max: number
  avg: number
  thresholdExceededCount: number
}

const THRESHOLDS: Record<string, { min?: number; max?: number }> = {
  temperature: { max: 30 },
  humidity: { max: 85 },
  ec: { max: 2.5 },
  ph: { min: 6.0, max: 7.5 },
}

/**
 * KST(Asia/Seoul) 기준 당일 시작/종료 시각을 ISO로 계산한다.
 */
const getKstDayRangeIso = (): { startIso: string; endIso: string; label: string } => {
  const now = new Date()
  const kstText = now.toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })
  const [datePart] = kstText.split(" ")
  const startKst = new Date(`${datePart}T00:00:00+09:00`)
  const endKst = new Date(`${datePart}T23:59:59.999+09:00`)
  return {
    startIso: startKst.toISOString(),
    endIso: endKst.toISOString(),
    label: datePart,
  }
}

/**
 * 센서 타입별 요약 통계를 계산한다.
 */
const buildStatsByType = (sensors: SensorRow[], readings: ReadingRow[]): SensorStats[] => {
  const sensorTypeById = new Map<string, string>()
  for (const s of sensors) {
    if (!s.id) continue
    sensorTypeById.set(s.id, s.sensor_type ?? "unknown")
  }

  const valuesByType = new Map<string, number[]>()
  for (const row of readings) {
    const t = sensorTypeById.get(row.sensor_id) ?? "unknown"
    const list = valuesByType.get(t) ?? []
    list.push(row.value)
    valuesByType.set(t, list)

  }

  const stats: SensorStats[] = []
  for (const [sensorType, values] of valuesByType.entries()) {
    if (values.length === 0) continue
    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce((acc, v) => acc + v, 0) / values.length
    const threshold = THRESHOLDS[sensorType]
    const thresholdExceededCount = threshold
      ? values.filter(
          (v) =>
            (typeof threshold.min === "number" && v < threshold.min) ||
            (typeof threshold.max === "number" && v > threshold.max),
        ).length
      : 0
    stats.push({
      sensorType,
      count: values.length,
      min,
      max,
      avg,
      thresholdExceededCount,
    })
  }

  return stats.sort((a, b) => a.sensorType.localeCompare(b.sensorType))
}

/**
 * 당일 sensor_readings를 기반으로 Gemini 일일 요약을 생성한다.
 */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!isRequireUserSuccess(auth)) {
    return auth.response
  }
  const { supabase, user } = auth

  const body = (await request.json().catch(() => ({}))) as DailySummaryBody
  const farmId = typeof body.farmId === "string" ? body.farmId.trim() : ""
  if (!farmId) {
    return NextResponse.json({ error: "farmId가 필요합니다." }, { status: 400 })
  }

  const { data: farm, error: farmErr } = await supabase
    .from("farms")
    .select("id, name")
    .eq("id", farmId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (farmErr) {
    return NextResponse.json(
      { error: "농장 정보를 조회하지 못했습니다.", details: farmErr.message },
      { status: 400 },
    )
  }
  if (!farm) {
    return NextResponse.json(
      { error: "해당 농장을 찾을 수 없거나 권한이 없습니다." },
      { status: 404 },
    )
  }

  const { data: sensors, error: sensorsErr } = await supabase
    .from("sensors")
    .select("id, name, sensor_type, unit")
    .eq("farm_id", farmId)

  if (sensorsErr) {
    return NextResponse.json(
      { error: "센서 목록을 불러오지 못했습니다.", details: sensorsErr.message },
      { status: 400 },
    )
  }
  const sensorRows = (sensors ?? []) as SensorRow[]
  const sensorIds = sensorRows.map((s) => s.id)
  if (sensorIds.length === 0) {
    return NextResponse.json({
      ok: true,
      farmId,
      sensorCount: 0,
      readingsCount: 0,
      thresholdExceededTotal: 0,
      summary:
        "오늘은 연결된 센서 데이터가 없어 요약을 생성하지 못했습니다. 센서 연결 상태를 확인해 주세요.",
      stats: [],
      farmName: farm.name,
    })
  }

  const { startIso, endIso, label } = getKstDayRangeIso()
  const { data: readings, error: readingsErr } = await supabase
    .from("sensor_readings")
    .select("sensor_id, value, recorded_at")
    .in("sensor_id", sensorIds)
    .gte("recorded_at", startIso)
    .lte("recorded_at", endIso)
    .order("recorded_at", { ascending: true })

  if (readingsErr) {
    return NextResponse.json(
      { error: "당일 센서 이력을 조회하지 못했습니다.", details: readingsErr.message },
      { status: 400 },
    )
  }

  const readingRows = (readings ?? []) as ReadingRow[]
  const stats = buildStatsByType(sensorRows, readingRows)
  const thresholdExceededTotal = stats.reduce((acc, s) => acc + s.thresholdExceededCount, 0)
  const readingsCount = readingRows.length

  const topExceeded = [...stats].sort(
    (a, b) => b.thresholdExceededCount - a.thresholdExceededCount,
  )[0]
  const topExceededSensorType = topExceeded?.sensorType ?? null
  const topExceededCount = topExceeded?.thresholdExceededCount ?? 0

  const context = [
    "작물: 딸기",
    `농장명: ${farm.name}`,
    `일자(KST): ${label}`,
    `총 측정 건수: ${readingsCount}`,
    `임계치 초과 총 건수: ${thresholdExceededTotal}`,
    `센서별 통계(JSON): ${JSON.stringify(stats)}`,
    "임계치 기준: temperature>30, humidity>85, ec>2.5, ph<6 또는 ph>7.5",
    `임계치 초과 TOP 센서: ${topExceededSensorType ?? "없음"} (건수: ${topExceededCount})`,
    "출력 마지막 문장은 반드시 '내일 점검 우선순위: <TOP 센서명> — 딸기 액션 아이템: <아이템1>, <아이템2>' 형식으로 작성하세요.",
  ].join("\n")

  try {
    const result = await generateText({
      model: getGeminiModel(),
      temperature: 0.3,
      maxOutputTokens: 1024,
      prompt: `당신은 딸기 스마트팜 운영 전문가입니다. 아래 데이터를 분석하여 농장주가 지금 즉시 해야 할 일을 중심으로 2~3문장으로 짧고 명확하게 요약해 주세요.

### 분석 지침:
- 현재 센서 상태에서 가장 문제가 되는 부분(${topExceededSensorType ?? "없음"})을 먼저 언급하세요.
- 딸기 생육을 위해 지금 바로 조치해야 할 사항(액션 아이템)을 구체적으로 제시하세요.
- 불필요한 인사말은 생략하고 핵심만 전달하세요.
- **중요: 답변을 중간에 끊지 말고 반드시 마침표(.)로 끝나는 완성된 문장으로 작성하세요.**
- 마지막 문장 형식: "내일 점검 우선순위: [센서명] — 딸기 액션 아이템: [조치1], [조치2]"

### 농장 데이터:
${context}`,
    })

    const summaryText = result.text.trim()

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[AI Summary Debug]:", {
        finishReason: result.finishReason,
        textLength: summaryText.length,
        fullText: summaryText,
      })
    }

    return NextResponse.json({
      ok: true,
      farmName: farm.name,
      dateKst: label,
      summary: summaryText,
      stats,
      readingsCount,
      thresholdExceededTotal,
    })
  } catch (e) {
    const message = normalizeGeminiErrorMessage(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

