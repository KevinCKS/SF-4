import { NextResponse } from "next/server"

import { isRequireUserSuccess, requireUser } from "@/lib/api/server"
import {
  clearMqttLogs,
  getMqttLogs,
} from "@/lib/mqtt/messageLog"
import { getManagerState } from "@/lib/mqtt/runtimeState"
import { DEFAULT_MQTT_TOPICS } from "@/lib/mqtt/topics"

/**
 * MQTT 수신 로그 조회·초기화 API(테스트 UI 전용).
 * - GET: 서버 메모리에 쌓인 수신 메시지 + 구독 대상 토픽 목록
 * - DELETE: 수신 로그 비우기
 */
export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireUser()
  if (!isRequireUserSuccess(auth)) {
    return auth.response
  }

  try {
    const state = getManagerState()
    return NextResponse.json(
      {
        topics:
          state.subscribedTopics.length > 0
            ? state.subscribedTopics
            : [...DEFAULT_MQTT_TOPICS],
        messages: getMqttLogs(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    )
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "MQTT 로그 조회에 실패했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE() {
  const auth = await requireUser()
  if (!isRequireUserSuccess(auth)) {
    return auth.response
  }

  try {
    clearMqttLogs()
    return NextResponse.json({ success: true })
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "MQTT 로그 초기화에 실패했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
