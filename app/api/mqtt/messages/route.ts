import { NextResponse } from "next/server"

import { createSupabaseServerClient } from "@/lib/supabaseServer"
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
    return NextResponse.json(
      {
        topics:
          getManagerState().subscribedTopics.length > 0
            ? getManagerState().subscribedTopics
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
    clearMqttLogs()
    return NextResponse.json({ success: true })
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "MQTT 로그 초기화에 실패했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
