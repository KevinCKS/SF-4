import { NextResponse } from "next/server"

import {
  isRequireUserSuccess,
  requireUser,
  toInternalErrorResponse,
} from "@/lib/api/server"
import { getSupabaseServiceRoleClient } from "@/lib/supabaseServiceRole"

export const dynamic = "force-dynamic"

type ClearBody = {
  /** 지정 시 해당 농장 소속 센서의 기록만 삭제한다. 생략 시 로그인 사용자의 모든 농장 범위. */
  farmId?: string
}

/**
 * Supabase `sensor_readings` 및 `alert_logs` 중, 로그인 사용자의 농장·센서에 해당하는 행만 삭제한다.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireUser()
    if (!isRequireUserSuccess(auth)) {
      return auth.response
    }
    const { supabase, user } = auth

    const body = (await request.json().catch(() => ({}))) as ClearBody
    const farmId =
      typeof body.farmId === "string" && body.farmId.length > 0
        ? body.farmId
        : undefined

    let farmIds: string[] = []

    if (farmId) {
      const { data: farm, error: farmErr } = await supabase
        .from("farms")
        .select("id")
        .eq("id", farmId)
        .eq("user_id", user.id)
        .maybeSingle()

      if (farmErr) {
        return NextResponse.json(
          { error: "농장 정보를 확인하지 못했습니다.", details: farmErr.message },
          { status: 400 },
        )
      }
      if (!farm) {
        return NextResponse.json(
          { error: "해당 농장을 찾을 수 없거나 권한이 없습니다." },
          { status: 404 },
        )
      }
      farmIds = [farm.id]
    } else {
      const { data: farms, error: farmsErr } = await supabase
        .from("farms")
        .select("id")
        .eq("user_id", user.id)

      if (farmsErr) {
        return NextResponse.json(
          { error: "농장 목록을 불러오지 못했습니다.", details: farmsErr.message },
          { status: 400 },
        )
      }
      farmIds = (farms ?? []).map((f) => f.id)
    }

    if (farmIds.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        message: "삭제할 농장이 없습니다.",
      })
    }

    // 1. 해당 농장들에 속한 모든 센서 ID 조회
    const { data: sensors, error: sensorsErr } = await supabase
      .from("sensors")
      .select("id")
      .in("farm_id", farmIds)

    if (sensorsErr) {
      return NextResponse.json(
        { error: "센서 목록을 불러오지 못했습니다.", details: sensorsErr.message },
        { status: 400 },
      )
    }

    const sensorIds = (sensors ?? []).map((s) => s.id as string)

    // RLS로 alert_logs DELETE가 막혀 있을 수 있어, 본인 농장 검증 후에는 서비스 롤로 삭제한다(키 없으면 세션 클라이언트).
    const admin = getSupabaseServiceRoleClient()
    const dbWrite = admin ?? supabase

    // 2. 해당 농장 또는 센서들에 연결된 모든 알림 설정 ID 조회
    const { data: settingsByFarm } = await dbWrite
      .from("alert_settings")
      .select("id")
      .in("farm_id", farmIds)

    let settingsBySensor: { id: string }[] | null = null
    if (sensorIds.length > 0) {
      const r = await dbWrite
        .from("alert_settings")
        .select("id")
        .in("sensor_id", sensorIds)
      settingsBySensor = r.data ?? null
    }

    const allSettingIds = Array.from(
      new Set([
        ...(settingsByFarm ?? []).map((s) => s.id),
        ...(settingsBySensor ?? []).map((s) => s.id),
      ]),
    )

    let alertLogsDeletedCount = 0
    if (allSettingIds.length > 0) {
      const { count, error: alertDelErr } = await dbWrite
        .from("alert_logs")
        .delete({ count: "exact" })
        .in("alert_setting_id", allSettingIds)

      if (!alertDelErr) {
        alertLogsDeletedCount = count ?? 0
      } else {
        console.error("[Clear] alert_logs 삭제 실패:", alertDelErr.message)
        return NextResponse.json(
          {
            error: "알림 로그를 삭제하지 못했습니다.",
            details: alertDelErr.message,
          },
          { status: 500 },
        )
      }
    }

    let deletedCount = 0
    if (sensorIds.length > 0) {
      const { count, error: delErr } = await dbWrite
        .from("sensor_readings")
        .delete({ count: "exact" })
        .in("sensor_id", sensorIds)

      if (!delErr) {
        deletedCount += count ?? 0
      } else {
        console.error("[Clear] sensor_readings 삭제 실패:", delErr.message)
        return NextResponse.json(
          {
            error: "센서 측정 기록을 삭제하지 못했습니다.",
            details: delErr.message,
          },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      alertLogsDeletedCount,
    })
  } catch (e) {
    return toInternalErrorResponse(e)
  }
}
