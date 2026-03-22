import { NextResponse } from "next/server"
import { z } from "zod"

import {
  isRequireUserSuccess,
  requireUser,
  toInternalErrorResponse,
} from "@/lib/api/server"
import { farmUpsertBodySchema } from "@/lib/validators/farm"
import type { Farm, UpdateFarmInput } from "@/types/farm"

/**
 * 농장 단일 조회·수정 API.
 * - GET: `id`로 1건 조회. RLS로 본인 `user_id` 행만 보이므로 타인 농장은 404와 동일하게 처리된다. (단계 2.5)
 * - PATCH: 본문 필드로 UPDATE 후 갱신된 행 반환. RLS로 본인 행만 수정 가능. (단계 2.6)
 */
export const dynamic = "force-dynamic"

const farmIdSchema = z.string().uuid("유효한 농장 ID가 아닙니다.")

type RouteContext = {
  params: Promise<{ id: string }>
}

export const GET = async (_request: Request, context: RouteContext) => {
  const { id: rawId } = await context.params
  const parsed = farmIdSchema.safeParse(rawId)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "요청이 올바르지 않습니다.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    )
  }
  const id = parsed.data

  try {
    const auth = await requireUser()
    if (!isRequireUserSuccess(auth)) {
      return auth.response
    }
    const { supabase } = auth

    const { data, error } = await supabase
      .from("farms")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        {
          error: "농장 정보를 불러오지 못했습니다.",
          details: error.message,
        },
        { status: 400 },
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: "농장을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    return NextResponse.json({ farm: data as Farm })
  } catch (e) {
    return toInternalErrorResponse(e)
  }
}

export const PATCH = async (request: Request, context: RouteContext) => {
  const { id: rawId } = await context.params
  const idParsed = farmIdSchema.safeParse(rawId)
  if (!idParsed.success) {
    return NextResponse.json(
      {
        error: "요청이 올바르지 않습니다.",
        details: idParsed.error.flatten(),
      },
      { status: 400 },
    )
  }
  const id = idParsed.data

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "JSON 본문이 올바르지 않습니다." },
      { status: 400 },
    )
  }

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

  const input = parsed.data as UpdateFarmInput

  try {
    const auth = await requireUser()
    if (!isRequireUserSuccess(auth)) {
      return auth.response
    }
    const { supabase } = auth

    const { data, error } = await supabase
      .from("farms")
      .update({
        name: input.name,
        description: input.description,
        location: input.location,
        area_sqm: input.area_sqm,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        {
          error: "농장 수정에 실패했습니다.",
          details: error.message,
        },
        { status: 400 },
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: "농장을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    return NextResponse.json({ farm: data as Farm })
  } catch (e) {
    return toInternalErrorResponse(e)
  }
}

/**
 * 농장 삭제 API.
 * - DELETE: `id`의 농장을 삭제한다. RLS 삭제 정책에 의해 본인 데이터만 삭제된다.
 * - sensors/sensor_readings이 `farms`를 참조하고 `ON DELETE CASCADE`가 설정되어 있으면 연쇄 삭제된다. (단계 2.7)
 */
export const DELETE = async (_request: Request, context: RouteContext) => {
  const { id: rawId } = await context.params
  const idParsed = farmIdSchema.safeParse(rawId)
  if (!idParsed.success) {
    return NextResponse.json(
      {
        error: "요청이 올바르지 않습니다.",
        details: idParsed.error.flatten(),
      },
      { status: 400 },
    )
  }

  const id = idParsed.data

  try {
    const auth = await requireUser()
    if (!isRequireUserSuccess(auth)) {
      return auth.response
    }
    const { supabase } = auth

    const { data, error } = await supabase
      .from("farms")
      .delete()
      .eq("id", id)
      .select("*")
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        {
          error: "농장 삭제에 실패했습니다.",
          details: error.message,
          // DB 스키마가 향후 sensors/sensor_readings FK를 추가하면
          // 여기서 FK 제약 조건 실패 메시지가 함께 내려올 수 있다.
          // (예: ON DELETE CASCADE 미설정)
        },
        { status: 400 },
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: "농장을 찾을 수 없습니다." },
        { status: 404 },
      )
    }

    return NextResponse.json({ farm: data as Farm })
  } catch (e) {
    return toInternalErrorResponse(e)
  }
}
