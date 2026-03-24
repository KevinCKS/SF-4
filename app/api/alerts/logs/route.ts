import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"

import {
  isRequireUserSuccess,
  requireUser,
  toInternalErrorResponse,
} from "@/lib/api/server"
import { getSupabaseServiceRoleClient } from "@/lib/supabaseServiceRole"

export const dynamic = "force-dynamic"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

/**
 * farm_id 소유 확인 후 해당 농장 범위의 alert_settings id 목록을 만든다.
 */
const getAlertSettingIdsForFarm = async (
  supabase: SupabaseClient,
  farmId: string,
): Promise<string[]> => {
  const { data: byFarm } = await supabase
    .from("alert_settings")
    .select("id")
    .eq("farm_id", farmId)

  const { data: sensors } = await supabase
    .from("sensors")
    .select("id")
    .eq("farm_id", farmId)

  const sensorIds = (sensors ?? []).map((s) => s.id as string)
  let bySensor: { id: string }[] = []
  if (sensorIds.length > 0) {
    const r = await supabase.from("alert_settings").select("id").in("sensor_id", sensorIds)
    bySensor = (r.data ?? []) as { id: string }[]
  }

  return Array.from(
    new Set([
      ...(byFarm ?? []).map((r) => r.id as string),
      ...bySensor.map((r) => r.id as string),
    ]),
  )
}

/**
 * 알림 이력(alert_logs) 목록 조회. farmId·기간·메시지 검색 필터를 지원한다.
 */
export async function GET(request: Request) {
  const auth = await requireUser()
  if (!isRequireUserSuccess(auth)) return auth.response
  const { supabase, user } = auth

  const { searchParams } = new URL(request.url)
  const farmId = searchParams.get("farmId")?.trim() ?? ""
  if (!farmId) {
    return NextResponse.json({ error: "farmId가 필요합니다." }, { status: 400 })
  }

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

  const settingIds = await getAlertSettingIdsForFarm(supabase, farmId)
  let limit = Number.parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT
  limit = Math.min(limit, MAX_LIMIT)

  let offset = Number.parseInt(searchParams.get("offset") ?? "0", 10)
  if (!Number.isFinite(offset) || offset < 0) offset = 0

  if (settingIds.length === 0) {
    return NextResponse.json({ logs: [], totalReturned: 0, total: 0, offset, limit })
  }

  const fromIso = searchParams.get("from")?.trim()
  const toIso = searchParams.get("to")?.trim()
  const messageQuery = searchParams.get("q")?.trim()

  let countQuery = supabase
    .from("alert_logs")
    .select("id", { count: "exact", head: true })
    .in("alert_setting_id", settingIds)

  if (fromIso) countQuery = countQuery.gte("created_at", fromIso)
  if (toIso) countQuery = countQuery.lte("created_at", toIso)
  if (messageQuery && messageQuery.length > 0) {
    countQuery = countQuery.ilike("message", `%${messageQuery}%`)
  }

  const { count: totalCount, error: countErr } = await countQuery
  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 })
  }

  const total = totalCount ?? 0

  let query = supabase
    .from("alert_logs")
    .select(
      `
      id,
      message,
      created_at,
      sensor_reading_id,
      alert_setting_id,
      alert_settings (
        farm_id,
        sensor_id,
        sensors ( name, sensor_type )
      )
    `,
    )
    .in("alert_setting_id", settingIds)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (fromIso) query = query.gte("created_at", fromIso)
  if (toIso) query = query.lte("created_at", toIso)
  if (messageQuery && messageQuery.length > 0) {
    query = query.ilike("message", `%${messageQuery}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    logs: data ?? [],
    totalReturned: (data ?? []).length,
    total,
    offset,
    limit,
  })
}

type DeleteLogsBody = {
  farmId?: unknown
  ids?: unknown
}

/**
 * 선택한 alert_logs 행만 삭제한다. 농장 소유·알림 설정 범위를 서버에서 다시 검증한다.
 */
export async function DELETE(request: Request) {
  try {
    const auth = await requireUser()
    if (!isRequireUserSuccess(auth)) return auth.response
    const { supabase, user } = auth

    const body = (await request.json().catch(() => ({}))) as DeleteLogsBody
    const farmId =
      typeof body.farmId === "string" && body.farmId.trim().length > 0
        ? body.farmId.trim()
        : ""
    const ids = Array.isArray(body.ids)
      ? body.ids.filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        )
      : []

    if (!farmId) {
      return NextResponse.json({ error: "farmId가 필요합니다." }, { status: 400 })
    }
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "삭제할 알림 이력을 선택해 주세요." },
        { status: 400 },
      )
    }

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

    const settingIds = await getAlertSettingIdsForFarm(supabase, farmId)
    if (settingIds.length === 0) {
      return NextResponse.json({ deleted: 0 })
    }

    const admin = getSupabaseServiceRoleClient()
    const dbWrite = admin ?? supabase

    const { error: delErr, count } = await dbWrite
      .from("alert_logs")
      .delete({ count: "exact" })
      .in("id", ids)
      .in("alert_setting_id", settingIds)

    if (delErr) {
      console.error("[alerts/logs DELETE]", delErr.message)
      return NextResponse.json(
        { error: "알림 이력을 삭제하지 못했습니다.", details: delErr.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ deleted: count ?? 0 })
  } catch (e) {
    return toInternalErrorResponse(e)
  }
}
