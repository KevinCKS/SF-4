/**
 * Supabase `farms` 테이블과 대응하는 타입이다.
 */
export type Farm = {
  id: string
  user_id: string
  name: string
  description: string | null
  location: string | null
  area_sqm: number
  created_at: string
  updated_at: string
}

/** 농장 생성 시 API/폼에서 사용하는 입력 형태 */
export type CreateFarmInput = {
  name: string
  description: string | null
  location: string | null
  area_sqm: number
}

/** 농장 수정 시 API에서 사용하는 입력 형태 (생성과 동일 필드) */
export type UpdateFarmInput = CreateFarmInput
