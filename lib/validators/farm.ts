import { z } from "zod"

/**
 * 농장 생성/수정 API 본문 검증용 스키마. 설명·위치는 빈 문자열이면 null로 정규화한다.
 */
export const farmUpsertBodySchema = z.object({
  name: z.string().min(1, "농장 이름을 입력해 주세요."),
  description: z
    .string()
    .optional()
    .transform((v) => {
      const t = v?.trim() ?? ""
      return t.length ? t : null
    }),
  location: z
    .string()
    .optional()
    .transform((v) => {
      const t = v?.trim() ?? ""
      return t.length ? t : null
    }),
  area_sqm: z.coerce.number().positive("면적은 0보다 커야 합니다."),
})

export type FarmUpsertBody = z.infer<typeof farmUpsertBodySchema>
