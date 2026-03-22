import { NextResponse } from "next/server"

import {
  isRequireUserSuccess,
  requireUser,
  toInternalErrorResponse,
} from "@/lib/api/server"

export const dynamic = "force-dynamic"

type ClearBody = {
  /** 지정 시 해당 농장 소속 센서의 기록만 삭제한다. 생략 시 로그인 사용자의 모든 농장 범위. */
  farmId?: string
}

/**
 * Supabase `sensor_readings` 중, 로그인 사용자의 농장·센서에 해당하는 행만 삭제한다(RLS와 동일 범위).
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
    if (sensorIds.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        message: "삭제할 센서가 없습니다.",
      })
    }

    /** `.in()` 목록이 길어질 때를 대비해 센서 ID를 나눠 삭제한다. */
    const chunkSize = 120
    let deletedCount = 0

    for (let i = 0; i < sensorIds.length; i += chunkSize) {
      const chunk = sensorIds.slice(i, i + chunkSize)

      const { count: chunkCount, error: countErr } = await supabase
        .from("sensor_readings")
        .select("*", { count: "exact", head: true })
        .in("sensor_id", chunk)

      if (countErr) {
        return NextResponse.json(
          { error: "삭제 대상 건수를 확인하지 못했습니다.", details: countErr.message },
          { status: 400 },
        )
      }

      const { error: delErr } = await supabase
        .from("sensor_readings")
        .delete()
        .in("sensor_id", chunk)

      if (delErr) {
        return NextResponse.json(
          { error: "sensor_readings 삭제에 실패했습니다.", details: delErr.message },
          { status: 500 },
        )
      }

      deletedCount += chunkCount ?? 0
    }

    return NextResponse.json({
      success: true,
      deletedCount,
    })
  } catch (e) {
    return toInternalErrorResponse(e)
  }
}
