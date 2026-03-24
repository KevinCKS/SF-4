import { NextResponse } from "next/server"

import {
  isRequireUserSuccess,
  requireUser,
  toInternalErrorResponse,
} from "@/lib/api/server"
import { getSupabaseServiceRoleClient } from "@/lib/supabaseServiceRole"

export const dynamic = "force-dynamic"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

type DeleteBody = {
  farmId?: unknown
  ids?: unknown
}

/**
 * 농장별 액추에이터 제어 이력(actuator_command_logs) 목록을 반환한다. offset·total을 지원한다.
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

  let limit = Number.parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT
  limit = Math.min(limit, MAX_LIMIT)

  let offset = Number.parseInt(searchParams.get("offset") ?? "0", 10)
  if (!Number.isFinite(offset) || offset < 0) offset = 0

  const { count: totalCount, error: countErr } = await supabase
    .from("actuator_command_logs")
    .select("id", { count: "exact", head: true })
    .eq("farm_id", farmId)

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 })
  }

  const total = totalCount ?? 0

  const { data, error } = await supabase
    .from("actuator_command_logs")
    .select("id, farm_id, user_id, actuator_key, topic, payload, success, created_at")
    .eq("farm_id", farmId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

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

/**
 * 선택한 actuator_command_logs 행만 삭제한다. 농장 소속은 서버에서 다시 검증한다.
 */
export async function DELETE(request: Request) {
  try {
    const auth = await requireUser()
    if (!isRequireUserSuccess(auth)) return auth.response
    const { supabase, user } = auth

    const body = (await request.json().catch(() => ({}))) as DeleteBody
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
        { error: "삭제할 제어 기록을 선택해 주세요." },
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

    const admin = getSupabaseServiceRoleClient()
    const dbWrite = admin ?? supabase

    const { error: delErr, count } = await dbWrite
      .from("actuator_command_logs")
      .delete({ count: "exact" })
      .in("id", ids)
      .eq("farm_id", farmId)

    if (delErr) {
      console.error("[actuator-commands DELETE]", delErr.message)
      return NextResponse.json(
        { error: "제어 기록을 삭제하지 못했습니다.", details: delErr.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ deleted: count ?? 0 })
  } catch (e) {
    return toInternalErrorResponse(e)
  }
}
