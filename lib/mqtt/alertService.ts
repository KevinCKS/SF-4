import { getSupabaseServiceRoleClient } from "@/lib/supabaseServiceRole"

/**
 * 센서 값이 임계치를 초과했는지 확인하고 필요 시 alert_logs에 기록한다.
 */
export const checkThresholdAndAlert = async (input: {
  sensorId: string
  value: number
  readingId?: string
}): Promise<void> => {
  const supabase = getSupabaseServiceRoleClient()
  if (!supabase) return

  // 1. 해당 센서 또는 농장에 설정된 활성 알림 설정 조회
  // 센서 ID로 직접 설정된 것이 있으면 우선순위, 없으면 농장 ID로 설정된 공통 설정 조회
  const { data: sensor } = await supabase
    .from("sensors")
    .select("farm_id, name, sensor_type")
    .eq("id", input.sensorId)
    .single()

  if (!sensor) return

  const { data: settings, error: setErr } = await supabase
    .from("alert_settings")
    .select("*")
    .or(`sensor_id.eq.${input.sensorId},farm_id.eq.${sensor.farm_id}`)
    .eq("is_active", true)

  if (setErr || !settings || settings.length === 0) return

  for (const setting of settings) {
    let isExceeded = false
    let alertMsg = ""

    if (setting.min_value !== null && input.value < setting.min_value) {
      isExceeded = true
      alertMsg = `${sensor.name} 하한 초과: 현재값 ${input.value} (설정값 ${setting.min_value})`
    } else if (setting.max_value !== null && input.value > setting.max_value) {
      isExceeded = true
      alertMsg = `${sensor.name} 상한 초과: 현재값 ${input.value} (설정값 ${setting.max_value})`
    }

    if (isExceeded) {
      // 2. alert_logs에 기록
      const { error: logErr } = await supabase.from("alert_logs").insert({
        alert_setting_id: setting.id,
        sensor_reading_id: input.readingId || null,
        message: alertMsg,
      })

      if (logErr && process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.error("[checkThresholdAndAlert] alert_logs 삽입 오류:", logErr.message)
      }

      // TODO: 7.3 선택 사항 - 이메일 발송 로직 추가 가능 (setting.notify_email 활용)
    }
  }
}
