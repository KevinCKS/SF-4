import { NextResponse } from "next/server"
import { z } from "zod"

import { createSupabaseServerClient } from "@/lib/supabaseServer"
import {
  getMqttStatus,
  publishMqtt,
} from "@/lib/mqtt/serverMqttClient"
import { MQTT_TOPICS } from "@/lib/mqtt/topics"

/**
 * MQTT 발행 프록시 API.
 * - POST: 서버에서 MQTT로 메시지를 발행한다.
 */
export const dynamic = "force-dynamic"

const publishBodySchema = z.object({
  topic: z.enum(MQTT_TOPICS),
  message: z.string().min(1, "message는 빈 값일 수 없습니다."),
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json(
      { error: "JSON 본문이 올바르지 않습니다." },
      { status: 400 },
    )
  }

  const parsed = publishBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "요청이 올바르지 않습니다.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    )
  }

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
    await publishMqtt(parsed.data.topic, parsed.data.message)
    const status = getMqttStatus()
    return NextResponse.json({
      success: true,
      ...status,
      topic: parsed.data.topic,
    })
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "MQTT 발행에 실패했습니다."
    return NextResponse.json(
      { error: "MQTT 발행에 실패했습니다.", details: message },
      { status: 500 },
    )
  }
}

