import { z } from "zod"

import type { CreateFarmInput } from "@/types/farm"

/**
 * 농장 생성/수정 API 본문 검증용 스키마.
 * (react-hook-form + zodResolver와 타입을 맞추기 위해 transform 대신 문자열 optional만 두고,
 *  빈 문자열 → null 정규화는 API에서 처리한다.)
 */
export const farmUpsertBodySchema = z.object({
  name: z.string().min(1, "농장 이름을 입력해 주세요."),
  description: z.string().optional(),
  location: z.string().optional(),
  area_sqm: z.coerce.number().positive("면적은 0보다 커야 합니다."),
})

export type FarmUpsertBody = z.infer<typeof farmUpsertBodySchema>

/** 검증된 본문을 DB용 CreateFarmInput으로 만든다. */
export const toCreateFarmInput = (body: FarmUpsertBody): CreateFarmInput => ({
  name: body.name,
  description:
    body.description != null && body.description.trim().length > 0
      ? body.description.trim()
      : null,
  location:
    body.location != null && body.location.trim().length > 0
      ? body.location.trim()
      : null,
  area_sqm: body.area_sqm,
})
