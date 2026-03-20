import { NextResponse } from "next/server"
import { z } from "zod"

import { createSupabaseServerClient } from "@/lib/supabaseServer"
import { connectAndInit, getMqttStatus } from "@/lib/mqtt/serverMqttClient"

/**
 * MQTT 연결 초기화 API.
 * - POST: 서버에서 MQTT 연결 후 지정 토픽 구독.
 * - (권장) 클라이언트는 브라우저 direct websocket으로 연결하지 않고 이 API를 호출한다.
 */
export const dynamic = "force-dynamic"

const ConnectBodySchema = z.object({
  // 현재는 옵션을 받지 않지만, 추후 farm_id 기반 토픽 확장에 대비해 두었다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: z.unknown().optional(),
})

export async function POST(request: Request) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _body = await request.json().catch(() => ({}))
  ConnectBodySchema.parse(_body)

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
    await connectAndInit()
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

