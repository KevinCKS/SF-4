import { NextResponse } from "next/server"

import {
  isRequireUserSuccess,
  requireUser,
  toInternalErrorResponse,
  type SupabaseServerClient,
} from "@/lib/api/server"
import { getSupabaseServiceRoleClient } from "@/lib/supabaseServiceRole"

export const dynamic = "force-dynamic"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

type DeleteReadingsBody = {
  farmId?: unknown
  ids?: unknown
}

const verifyFarmAndSensorIds = async (
  supabase: SupabaseServerClient,
  userId: string,
  farmId: string,
): Promise<
  | { ok: false; response: NextResponse }
  | { ok: true; sensorIds: string[] }
> => {
  const { data: farm, error: farmErr } = await supabase
    .from("farms")
    .select("id")
    .eq("id", farmId)
    .eq("user_id", userId)
    .maybeSingle()

  if (farmErr) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "농장 정보를 확인하지 못했습니다.", details: farmErr.message },
        { status: 400 },
      ),
    }
  }
  if (!farm) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "해당 농장을 찾을 수 없거나 권한이 없습니다." },
        { status: 404 },
      ),
    }
  }

  const { data: sensors, error: sensorsErr } = await supabase
    .from("sensors")
    .select("id")
    .eq("farm_id", farmId)

  if (sensorsErr) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "센서 목록을 불러오지 못했습니다.", details: sensorsErr.message },
        { status: 500 },
      ),
    }
  }

  const sensorIds = (sensors ?? []).map((s) => s.id as string)
  return { ok: true, sensorIds }
}

/**
 * 농장에 속한 sensor_readings 를 최신 순으로 조회한다. sensors 를 조인해 이름·종류·단위를 포함한다.
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

  const gate = await verifyFarmAndSensorIds(supabase, user.id, farmId)
  if (!gate.ok) return gate.response

  let limit = Number.parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT
  limit = Math.min(limit, MAX_LIMIT)

  let offset = Number.parseInt(searchParams.get("offset") ?? "0", 10)
  if (!Number.isFinite(offset) || offset < 0) offset = 0

  if (gate.sensorIds.length === 0) {
    return NextResponse.json({
      readings: [],
      totalReturned: 0,
      total: 0,
      offset,
      limit,
    })
  }

  const { count: totalCount, error: countErr } = await supabase
    .from("sensor_readings")
    .select("id", { count: "exact", head: true })
    .in("sensor_id", gate.sensorIds)

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 })
  }

  const total = totalCount ?? 0

  const { data, error } = await supabase
    .from("sensor_readings")
    .select(
      `
      id,
      sensor_id,
      value,
      recorded_at,
      created_at,
      updated_at,
      sensors ( name, sensor_type, unit )
    `,
    )
    .in("sensor_id", gate.sensorIds)
    .order("recorded_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    readings: data ?? [],
    totalReturned: (data ?? []).length,
    total,
    offset,
    limit,
  })
}

/**
 * 선택한 sensor_readings 행만 삭제한다. 농장·센서 소속을 서버에서 다시 검증한다.
 */
export async function DELETE(request: Request) {
  try {
    const auth = await requireUser()
    if (!isRequireUserSuccess(auth)) return auth.response
    const { supabase, user } = auth

    const body = (await request.json().catch(() => ({}))) as DeleteReadingsBody
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
        { error: "삭제할 측정값을 선택해 주세요." },
        { status: 400 },
      )
    }

    const gate = await verifyFarmAndSensorIds(supabase, user.id, farmId)
    if (!gate.ok) return gate.response

    if (gate.sensorIds.length === 0) {
      return NextResponse.json({ deleted: 0 })
    }

    const admin = getSupabaseServiceRoleClient()
    const dbWrite = admin ?? supabase

    const { error: delErr, count } = await dbWrite
      .from("sensor_readings")
      .delete({ count: "exact" })
      .in("id", ids)
      .in("sensor_id", gate.sensorIds)

    if (delErr) {
      console.error("[sensor-readings DELETE]", delErr.message)
      return NextResponse.json(
        { error: "측정값을 삭제하지 못했습니다.", details: delErr.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ deleted: count ?? 0 })
  } catch (e) {
    return toInternalErrorResponse(e)
  }
}
