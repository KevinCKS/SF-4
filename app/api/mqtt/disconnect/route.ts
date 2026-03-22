import { NextResponse } from "next/server"

import { isRequireUserSuccess, requireUser } from "@/lib/api/server"
import { disconnectMqtt, getMqttStatus } from "@/lib/mqtt/serverMqttClient"

/**
 * MQTT 연결 해제 API. 서버 측 mqtt.js 클라이언트를 종료한다.
 */
export const dynamic = "force-dynamic"

export async function POST() {
  const auth = await requireUser()
  if (!isRequireUserSuccess(auth)) {
    return auth.response
  }

  try {
    disconnectMqtt()
    const status = getMqttStatus()
    return NextResponse.json({ success: true, ...status })
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "MQTT 연결 해제에 실패했습니다."
    return NextResponse.json(
      { error: "MQTT 연결 해제에 실패했습니다.", details: message },
      { status: 500 },
    )
  }
}
