import { generateText } from "ai"
import { NextResponse } from "next/server"

import { getGeminiModel } from "@/lib/ai/gemini"
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

  const context = [
    `농장명: ${farm.name}`,
    `일자(KST): ${label}`,
    `총 측정 건수: ${readingsCount}`,
    `임계치 초과 총 건수: ${thresholdExceededTotal}`,
    `센서별 통계(JSON): ${JSON.stringify(stats)}`,
    "임계치 기준: temperature>30, humidity>85, ec>2.5, ph<6 또는 ph>7.5",
  ].join("\n")

  try {
    const result = await generateText({
      model: getGeminiModel(),
      temperature: 0.2,
      maxOutputTokens: 500,
      prompt: [
        "당신은 스마트팜 운영 분석가입니다.",
        "아래 컨텍스트를 기반으로 한국어로만 일일 요약을 작성하세요.",
        "반드시 2~4문장으로 작성하고, 마지막 문장에는 내일 점검할 우선순위 1가지를 제시하세요.",
        "",
        context,
      ].join("\n"),
    })

    return NextResponse.json({
      ok: true,
      farmName: farm.name,
      dateKst: label,
      summary: result.text,
      stats,
      readingsCount,
      thresholdExceededTotal,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI 요약 생성 중 오류가 발생했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

