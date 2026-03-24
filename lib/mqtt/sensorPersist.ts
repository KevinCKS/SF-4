import { checkThresholdAndAlert } from "@/lib/mqtt/alertService"
import type { SensorTopicKey } from "@/lib/mqtt/topicConfig"
import { getSupabaseServiceRoleClient } from "@/lib/supabaseServiceRole"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 서비스 롤 미설정 경고를 한 번만 출력한다. */
let warnedMissingServiceRole = false

/** 토픽 경로에 포함된 farm UUID 캡처용 */
const FARM_UUID_IN_PATH =
  "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"

/** 센서 타입별 표시 이름·단위(레포 sensors 스키마와 맞춤) */
const SENSOR_META: Record<
  SensorTopicKey,
  { name: string; unit: string | null }
> = {
  temperature: { name: "온도", unit: "°C" },
  humidity: { name: "습도", unit: "%" },
  ec: { name: "EC", unit: "mS/cm" },
  ph: { name: "pH", unit: null },
}

const SENSOR_KEYS: SensorTopicKey[] = ["temperature", "humidity", "ec", "ph"]

type ParsedTopic =
  | {
      kind: "single"
      sensorKey: SensorTopicKey
      farmIdFromTopic: string | null
    }
  | { kind: "all"; farmIdFromTopic: string | null }
  | { kind: "skip" }

/**
 * 토픽 문자열에서 센서 수신 여부와 farm_id(경로에 있을 때)를 해석한다.
 */
const parseSensorTopic = (topic: string): ParsedTopic => {
  const t = topic.trim()

  const withFarm = new RegExp(
    `^smartfarm/${FARM_UUID_IN_PATH}/sensors/(temperature|humidity|ec|ph)$`,
    "i",
  ).exec(t)
  if (withFarm) {
    return {
      kind: "single",
      sensorKey: withFarm[2].toLowerCase() as SensorTopicKey,
      farmIdFromTopic: withFarm[1],
    }
  }

  const legacy = /^smartfarm\/sensors\/(temperature|humidity|ec|ph)$/i.exec(t)
  if (legacy) {
    return {
      kind: "single",
      sensorKey: legacy[1].toLowerCase() as SensorTopicKey,
      farmIdFromTopic: null,
    }
  }

  const allWithFarm = new RegExp(
    `^smartfarm/${FARM_UUID_IN_PATH}/sensors/all$`,
    "i",
  ).exec(t)
  if (allWithFarm) {
    return { kind: "all", farmIdFromTopic: allWithFarm[1] }
  }

  if (/^smartfarm\/sensors\/all$/i.test(t)) {
    return { kind: "all", farmIdFromTopic: null }
  }

  return { kind: "skip" }
}

const isUuid = (s: string): boolean => UUID_RE.test(s)

/**
 * JSON 본문에서 farm_id(uuid)를 꺼낸다.
 */
const extractFarmIdFromPayload = (obj: Record<string, unknown>): string | null => {
  const raw = obj.farm_id ?? obj.farmId
  if (typeof raw === "string" && isUuid(raw)) return raw
  return null
}

/**
 * 단일 센서 값을 숫자로 꺼낸다.
 */
const extractNumeric = (
  obj: Record<string, unknown>,
  sensorKey: SensorTopicKey,
): number | null => {
  if (typeof obj.value === "number" && Number.isFinite(obj.value)) {
    return obj.value
  }
  const v = obj[sensorKey]
  if (typeof v === "number" && Number.isFinite(v)) return v
  return null
}

/**
 * 기록 시각(recorded_at)을 ISO 문자열로 정규화한다.
 */
const extractRecordedAtIso = (obj: Record<string, unknown>): string => {
  const raw = obj.timestamp ?? obj.recorded_at ?? obj.recordedAt
  if (typeof raw === "string" || typeof raw === "number") {
    const d = new Date(raw)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return new Date().toISOString()
}

/**
 * farm_id + sensor_type 으로 sensors 행을 찾거나 생성해 id를 반환한다.
 */
const getOrCreateSensorId = async (
  farmId: string,
  sensorKey: SensorTopicKey,
): Promise<string | null> => {
  const supabase = getSupabaseServiceRoleClient()
  if (!supabase) return null

  const meta = SENSOR_META[sensorKey]

  const { data: existing, error: selErr } = await supabase
    .from("sensors")
    .select("id")
    .eq("farm_id", farmId)
    .eq("sensor_type", sensorKey)
    .maybeSingle()

  if (selErr) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("[sensorPersist] sensors 조회 오류:", selErr.message)
    }
    return null
  }
  if (existing?.id) return existing.id

  const { data: inserted, error: insErr } = await supabase
    .from("sensors")
    .insert({
      farm_id: farmId,
      name: meta.name,
      sensor_type: sensorKey,
      unit: meta.unit,
    })
    .select("id")
    .single()

  if (!insErr && inserted?.id) return inserted.id

  if (insErr?.code === "23505") {
    const { data: again } = await supabase
      .from("sensors")
      .select("id")
      .eq("farm_id", farmId)
      .eq("sensor_type", sensorKey)
      .maybeSingle()
    return again?.id ?? null
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.error("[sensorPersist] sensors 삽입 오류:", insErr?.message)
  }
  return null
}

/**
 * sensor_readings 에 한 건 삽입한다.
 */
const insertReading = async (input: {
  sensorId: string
  value: number
  recordedAtIso: string
}): Promise<string | null> => {
  const supabase = getSupabaseServiceRoleClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from("sensor_readings")
    .insert({
      sensor_id: input.sensorId,
      value: input.value,
      recorded_at: input.recordedAtIso,
    })
    .select("id")
    .single()

  if (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("[sensorPersist] sensor_readings 삽입 오류:", error.message)
    }
    return null
  }

  // 임계치 체크 및 알림 로그 생성 호출
  void checkThresholdAndAlert({
    sensorId: input.sensorId,
    value: input.value,
    readingId: data?.id,
  })

  return data?.id ?? null
}

/**
 * farms 에 해당 id 가 존재하는지 확인한다(잘못된 farm_id 저장 방지).
 */
const farmExists = async (farmId: string): Promise<boolean> => {
  const supabase = getSupabaseServiceRoleClient()
  if (!supabase) return false
  const { data, error } = await supabase
    .from("farms")
    .select("id")
    .eq("id", farmId)
    .maybeSingle()
  if (error) return false
  return Boolean(data?.id)
}

/**
 * MQTT 수신 한 건을 파싱해 sensors / sensor_readings 에 반영한다.
 * - 서비스 롤 키가 없으면 조용히 생략한다(로컬 개발 시 env 안내).
 */
export const persistMqttSensorPayload = async (
  topic: string,
  rawPayload: string,
): Promise<void> => {
  if (!getSupabaseServiceRoleClient()) {
    if (process.env.NODE_ENV === "development" && !warnedMissingServiceRole) {
      warnedMissingServiceRole = true
      // eslint-disable-next-line no-console
      console.warn(
        "[sensorPersist] SUPABASE_SERVICE_ROLE_KEY 가 없어 DB 저장을 건너뜁니다.",
      )
    }
    return
  }

  const parsedTopic = parseSensorTopic(topic)
  if (parsedTopic.kind === "skip") return

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawPayload) as Record<string, unknown>
  } catch {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("[sensorPersist] JSON 이 아닌 payload — 저장 생략:", topic)
    }
    return
  }

  const recordedAtIso = extractRecordedAtIso(body)

  const resolveFarmId = (fromTopic: string | null): string | null => {
    if (fromTopic && isUuid(fromTopic)) return fromTopic
    return extractFarmIdFromPayload(body)
  }

  if (parsedTopic.kind === "single") {
    const farmId = resolveFarmId(parsedTopic.farmIdFromTopic)
    if (!farmId) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.warn(
          "[sensorPersist] farm_id 없음 — 토픽에 UUID 경로를 넣거나 JSON 에 farm_id 를 넣으세요:",
          topic,
        )
      }
      return
    }
    if (!(await farmExists(farmId))) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.warn("[sensorPersist] 존재하지 않는 farm_id — 저장 생략:", farmId)
      }
      return
    }

    const value = extractNumeric(body, parsedTopic.sensorKey)
    if (value === null) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.warn(
          "[sensorPersist] 숫자 value 를 찾지 못함 — 저장 생략:",
          topic,
        )
      }
      return
    }

    const sensorId = await getOrCreateSensorId(farmId, parsedTopic.sensorKey)
    if (!sensorId) return
    await insertReading({
      sensorId,
      value,
      recordedAtIso,
    })
    return
  }

  // kind === "all"
  const farmId = resolveFarmId(parsedTopic.farmIdFromTopic)
  if (!farmId) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn(
        "[sensorPersist] sensors/all 은 farm_id 가 필요합니다(토픽 경로 또는 JSON).",
      )
    }
    return
  }
  if (!(await farmExists(farmId))) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("[sensorPersist] 존재하지 않는 farm_id — 저장 생략:", farmId)
    }
    return
  }

  for (const key of SENSOR_KEYS) {
    const value = extractNumeric(body, key)
    if (value === null) continue
    const sensorId = await getOrCreateSensorId(farmId, key)
    if (!sensorId) continue
    await insertReading({ sensorId, value, recordedAtIso })
  }
}
