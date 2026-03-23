import { generateText } from "ai"
import { NextResponse } from "next/server"

import {
  isRequireUserSuccess,
  requireUser,
} from "@/lib/api/server"
import {
  getDefaultGeminiModelName,
  getGeminiModel,
  hasGeminiApiKey,
} from "@/lib/ai/gemini"

export const dynamic = "force-dynamic"

type PingBody = {
  prompt?: string
}

/**
 * Gemini 연동 상태를 빠르게 확인하는 테스트 API.
 * - 로그인 사용자만 호출 가능
 * - prompt를 전달하면 해당 텍스트로 1회 생성
 */
export async function POST(request: Request) {
  const auth = await requireUser()
  if (!isRequireUserSuccess(auth)) {
    return auth.response
  }

  if (!hasGeminiApiKey()) {
    return NextResponse.json(
      { error: "GOOGLE_GENERATIVE_AI_API_KEY 환경 변수가 설정되지 않았습니다." },
      { status: 503 },
    )
  }

  try {
    const body = (await request.json().catch(() => ({}))) as PingBody
    const prompt =
      typeof body.prompt === "string" && body.prompt.trim().length > 0
        ? body.prompt.trim()
        : "스마트팜 AI 연동 테스트입니다. 한 줄로 응답해 주세요."

    const modelName = getDefaultGeminiModelName()
    const result = await generateText({
      model: getGeminiModel(modelName),
      prompt,
      temperature: 0.2,
      maxOutputTokens: 200,
    })

    return NextResponse.json({
      ok: true,
      model: modelName,
      text: result.text,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Gemini 호출 중 오류가 발생했습니다."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

