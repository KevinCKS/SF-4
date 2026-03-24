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

const actuatorKeySchema = z.enum(["led", "pump", "fan1", "fan2"])

const publishBodySchema = z
  .object({
    topic: z
      .string()
      .min(1, "topic은 빈 값일 수 없습니다.")
      .refine(isAllowedMqttTopic, "허용되지 않은 토픽입니다. (smartfarm/ prefix만 허용)"),
    message: z.string().min(1, "message는 빈 값일 수 없습니다."),
    /** 있으면 actuator_command_logs에 성공 기록(본인 농장만). */
    farmId: z.string().uuid().optional(),
    actuatorKey: actuatorKeySchema.optional(),
  })
  .refine(
    (d) => (d.actuatorKey == null && d.farmId == null) || (d.actuatorKey != null && d.farmId != null),
    { message: "actuatorKey와 farmId는 함께 보내거나 둘 다 생략해야 합니다." },
  )

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
  const { supabase, user } = auth

  try {
    await publishMqtt(parsed.data.topic, parsed.data.message)
    const status = getMqttStatus()

    const { farmId, actuatorKey } = parsed.data
    if (farmId && actuatorKey) {
      const { data: farm, error: farmErr } = await supabase
        .from("farms")
        .select("id")
        .eq("id", farmId)
        .eq("user_id", user.id)
        .maybeSingle()
      if (!farmErr && farm?.id) {
        const { error: logErr } = await supabase.from("actuator_command_logs").insert({
          farm_id: farmId,
          user_id: user.id,
          actuator_key: actuatorKey,
          topic: parsed.data.topic,
          payload: parsed.data.message,
          success: true,
        })
        if (logErr && process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.error("[mqtt/publish] actuator_command_logs 삽입 실패:", logErr.message)
        }
      }
    }

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

