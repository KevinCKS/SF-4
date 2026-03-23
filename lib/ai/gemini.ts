import { createGoogleGenerativeAI } from "@ai-sdk/google"

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"

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

