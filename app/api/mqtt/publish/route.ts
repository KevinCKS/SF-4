import { NextResponse } from "next/server"
import { z } from "zod"

import { isRequireUserSuccess, requireUser } from "@/lib/api/server"
import {
  getMqttStatus,
  publishMqtt,
} from "@/lib/mqtt/serverMqttClient"
import { isAllowedMqttTopic } from "@/lib/mqtt/topics"

/**
 * MQTT 발행 프록시 API.
 * - POST: 서버에서 MQTT로 메시지를 발행한다.
 */
export const dynamic = "force-dynamic"

const publishBodySchema = z.object({
  topic: z
    .string()
    .min(1, "topic은 빈 값일 수 없습니다.")
    .refine(isAllowedMqttTopic, "허용되지 않은 토픽입니다. (smartfarm/ prefix만 허용)"),
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

  const auth = await requireUser()
  if (!isRequireUserSuccess(auth)) {
    return auth.response
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

