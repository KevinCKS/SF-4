import { NextResponse } from "next/server"
import { isRequireUserSuccess, requireUser } from "@/lib/api/server"

export const dynamic = "force-dynamic"

/**
 * 특정 농장의 센서 목록 조회
 */
export async function GET(request: Request) {
  const auth = await requireUser()
  if (!isRequireUserSuccess(auth)) return auth.response
  const { supabase } = auth

  const { searchParams } = new URL(request.url)
  const farmId = searchParams.get("farmId")

  if (!farmId) {
    return NextResponse.json({ error: "farmId가 필요합니다." }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("sensors")
    .select("id, farm_id, name, sensor_type, unit, created_at, updated_at")
    .eq("farm_id", farmId)
    .order("name", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
