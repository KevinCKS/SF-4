import { createGoogleGenerativeAI } from "@ai-sdk/google"

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"

/**
 * Gemini API 키 존재 여부를 확인한다.
 */
export const hasGeminiApiKey = (): boolean =>
  typeof process.env.GOOGLE_GENERATIVE_AI_API_KEY === "string" &&
  process.env.GOOGLE_GENERATIVE_AI_API_KEY.trim().length > 0

/**
 * Google Gemini 모델 인스턴스를 반환한다.
 * @param modelName - 사용할 Gemini 모델명(기본: gemini-1.5-flash)
 */
export const getGeminiModel = (modelName: string = DEFAULT_GEMINI_MODEL) => {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY 환경 변수가 설정되지 않았습니다.")
  }

  const google = createGoogleGenerativeAI({ apiKey })
  return google(modelName)
}

/**
 * 현재 기본 Gemini 모델명을 반환한다.
 */
export const getDefaultGeminiModelName = (): string => DEFAULT_GEMINI_MODEL

/**
 * Gemini 호출 오류를 사용자용 한글 메시지로 정규화한다.
 */
export const normalizeGeminiErrorMessage = (e: unknown): string => {
  const raw = e instanceof Error ? e.message : "Gemini 호출 중 오류가 발생했습니다."
  const lower = raw.toLowerCase()

  if (lower.includes("api key was reported as leaked")) {
    return "Gemini API 키가 유출된 것으로 감지되어 차단되었습니다. 새 API 키로 교체해 주세요."
  }
  if (lower.includes("invalid") || lower.includes("not valid")) {
    if (lower.includes("api key")) {
      return "Gemini API 키가 유효하지 않습니다. 키 값을 다시 확인해 주세요."
    }
  }
  if (lower.includes("quota") || lower.includes("rate limit")) {
    return "Gemini 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."
  }
  if (lower.includes("permission") || lower.includes("forbidden")) {
    return "Gemini 호출 권한이 없습니다. 프로젝트/키 권한 설정을 확인해 주세요."
  }

  return raw
}

