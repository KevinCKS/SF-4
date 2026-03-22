import { NextResponse } from "next/server"

import { isRequireUserSuccess, requireUser } from "@/lib/api/server"
import { getMqttStatus } from "@/lib/mqtt/serverMqttClient"

/**
 * MQTT 연결 상태 확인 API.
 * - GET: 현재 서버에서 관리 중인 MQTT 클라이언트 상태를 반환한다.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireUser()
  if (!isRequireUserSuccess(auth)) {
    return auth.response
  }

  try {
    return NextResponse.json(getMqttStatus())
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "MQTT 상태 조회에 실패했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

