import { NextResponse } from "next/server"
import { isRequireUserSuccess, requireUser } from "@/lib/api/server"

export const dynamic = "force-dynamic"

/**
 * 특정 농장의 알림 설정 목록 조회
 */
export async function GET(request: Request) {
  const auth = await requireUser()
  if (!isRequireUserSuccess(auth)) return auth.response
  const { supabase, user } = auth

  const { searchParams } = new URL(request.url)
  const farmId = searchParams.get("farmId")

  if (!farmId) {
    return NextResponse.json({ error: "farmId가 필요합니다." }, { status: 400 })
  }

  // 사용자가 해당 농장에 권한이 있는지 확인 후 설정 조회
  const { data, error } = await supabase
    .from("alert_settings")
    .select(`
      *,
      sensor:sensors(id, name, sensor_type)
    `)
    .eq("farm_id", farmId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

/**
 * 알림 설정 생성 또는 수정
 */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!isRequireUserSuccess(auth)) return auth.response
  const { supabase } = auth

  const body = await request.json()
  const { id, farm_id, sensor_id, min_value, max_value, notify_email, is_active } = body

  if (!farm_id && !sensor_id) {
    return NextResponse.json({ error: "farm_id 또는 sensor_id가 필요합니다." }, { status: 400 })
  }

  let result
  if (id) {
    // 수정
    result = await supabase
      .from("alert_settings")
      .update({
        min_value,
        max_value,
        notify_email,
        is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()
  } else {
    // 생성
    result = await supabase
      .from("alert_settings")
      .insert({
        farm_id,
        sensor_id,
        min_value,
        max_value,
        notify_email,
        is_active,
      })
      .select()
      .single()
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  return NextResponse.json(result.data)
}

/**
 * 알림 설정 삭제
 */
export async function DELETE(request: Request) {
  const auth = await requireUser()
  if (!isRequireUserSuccess(auth)) return auth.response
  const { supabase } = auth

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 })
  }

  const { error } = await supabase.from("alert_settings").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
