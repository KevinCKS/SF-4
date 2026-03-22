import { NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"

import { createSupabaseServerClient } from "@/lib/supabaseServer"

/** Route Handler에서 사용하는 미인증 응답 메시지(한글). */
export const UNAUTHORIZED_JSON_MESSAGE =
  "인증이 필요합니다. 다시 로그인해 주세요." as const

export type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>

/**
 * 인증 성공 시 Supabase 클라이언트와 사용자 정보.
 */
export type RequireUserSuccess = {
  supabase: SupabaseServerClient
  user: User
}

/**
 * 인증 실패 시 반환할 NextResponse.
 */
export type RequireUserFailure = {
  response: NextResponse
}

export type RequireUserResult = RequireUserSuccess | RequireUserFailure

/**
 * Route Handler에서 Supabase 세션을 검증한다.
 * @returns 성공 시 `supabase`·`user`, 실패 시 `response`(401 JSON)를 포함한 객체
 */
export const requireUser = async (): Promise<RequireUserResult> => {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      response: NextResponse.json(
        { error: UNAUTHORIZED_JSON_MESSAGE },
        { status: 401 },
      ),
    }
  }

  return { supabase, user }
}

/**
 * `requireUser` 결과가 성공인지 판별한다(타입 가드).
 * @param result - `requireUser()` 반환값
 */
export const isRequireUserSuccess = (
  result: RequireUserResult,
): result is RequireUserSuccess => "supabase" in result && "user" in result

/**
 * 알 수 없는 예외를 Route Handler용 500 JSON으로 변환한다.
 * @param e - `catch`로 잡은 값
 */
export const toInternalErrorResponse = (e: unknown) => {
  const message =
    e instanceof Error ? e.message : "요청 처리 중 오류가 발생했습니다."
  return NextResponse.json({ error: message }, { status: 500 })
}
