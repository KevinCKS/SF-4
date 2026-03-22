import { NextResponse } from "next/server"
import { z } from "zod"

import { isRequireUserSuccess, requireUser } from "@/lib/api/server"
import { connectAndInit, getMqttStatus } from "@/lib/mqtt/serverMqttClient"

/**
 * MQTT 연결 초기화 API.
 * - POST: 서버에서 MQTT 연결 후 지정 토픽 구독.
 * - (권장) 클라이언트는 브라우저 direct websocket으로 연결하지 않고 이 API를 호출한다.
 */
export const dynamic = "force-dynamic"

const ConnectBodySchema = z.object({
  topics: z.array(z.string()).optional(),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const parsed = ConnectBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "요청이 올바르지 않습니다.", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const auth = await requireUser()
  if (!isRequireUserSuccess(auth)) {
    return auth.response
  }

  try {
    const topics = parsed.data.topics
    await connectAndInit(topics)
    const status = getMqttStatus()
    return NextResponse.json({ success: true, ...status })
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "MQTT 연결에 실패했습니다."
    return NextResponse.json(
      { error: "MQTT 연결에 실패했습니다.", details: message },
      { status: 500 },
    )
  }
}

