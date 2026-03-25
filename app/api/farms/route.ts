import { NextResponse } from "next/server"

import {
  isRequireUserSuccess,
  requireUser,
  toInternalErrorResponse,
} from "@/lib/api/server"
import { farmUpsertBodySchema, toCreateFarmInput } from "@/lib/validators/farm"
import type { Farm } from "@/types/farm"

/**
 * 농장 목록/생성 API.
 * - GET: 로그인 사용자의 `user_id`로 목록 (단계 2.3)
 * - POST: 농장 INSERT (단계 2.4)
 */
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const auth = await requireUser()
    if (!isRequireUserSuccess(auth)) {
      return auth.response
    }
    const { supabase, user } = auth

    const { data, error } = await supabase
      .from("farms")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        {
          error: "농장 목록을 불러오지 못했습니다.",
          details: error.message,
        },
        { status: 400 },
      )
    }

    return NextResponse.json({ farms: (data ?? []) as Farm[] })
  } catch (e) {
    return toInternalErrorResponse(e)
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser()
    if (!isRequireUserSuccess(auth)) {
      return auth.response
    }
    const { supabase, user } = auth

    const body = await request.json()
    const parsed = farmUpsertBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "입력값이 올바르지 않습니다.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      )
    }

    const input = toCreateFarmInput(parsed.data)

    const { data, error } = await supabase
      .from("farms")
      .insert({
        user_id: user.id,
        name: input.name,
        description: input.description,
        location: input.location,
        area_sqm: input.area_sqm,
      })
      .select("*")
      .single()

    if (error) {
      return NextResponse.json(
        {
          error: "농장 추가에 실패했습니다.",
          details: error.message,
        },
        { status: 400 },
      )
    }

    return NextResponse.json({ farm: data as Farm })
  } catch (e) {
    return toInternalErrorResponse(e)
  }
}
