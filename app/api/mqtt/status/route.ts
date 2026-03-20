import { NextResponse } from "next/server"

import { createSupabaseServerClient } from "@/lib/supabaseServer"
import { getMqttStatus } from "@/lib/mqtt/serverMqttClient"

/**
 * MQTT 연결 상태 확인 API.
 * - GET: 현재 서버에서 관리 중인 MQTT 클라이언트 상태를 반환한다.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { error: "인증이 필요합니다. 다시 로그인해 주세요." },
      { status: 401 },
    )
  }

  try {
    return NextResponse.json(getMqttStatus())
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "MQTT 상태 조회에 실패했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

