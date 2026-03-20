"use client"

import * as React from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import type { Farm } from "@/types/farm"
import { farmUpsertBodySchema } from "@/lib/validators/farm"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

/**
 * 농장 목록 + 추가 폼. GET으로 목록, POST로 추가 후 목록을 다시 불러온다. (단계 2.3·2.4)
 */
type CreateFarmFormValues = z.input<typeof farmUpsertBodySchema>

/** API 본문의 `details`(문자열 또는 Zod flatten)를 사용자용 문장으로 만든다. */
const formatApiDetails = (details: unknown): string | null => {
  if (typeof details === "string" && details.trim()) return details.trim()
  if (!details || typeof details !== "object") return null
  const d = details as {
    fieldErrors?: Record<string, string[] | undefined>
    formErrors?: string[]
  }
  const parts: string[] = []
  if (d.fieldErrors && typeof d.fieldErrors === "object") {
    for (const msgs of Object.values(d.fieldErrors)) {
      if (Array.isArray(msgs)) parts.push(...msgs.filter(Boolean))
    }
  }
  if (Array.isArray(d.formErrors)) parts.push(...d.formErrors.filter(Boolean))
  return parts.length ? parts.join(" ") : null
}

const parseApiError = async (res: Response): Promise<string> => {
  try {
    const json = (await res.json()) as {
      error?: string
      details?: unknown
    }
    const detailMsg = formatApiDetails(json.details)
    if (json.error && detailMsg) return `${json.error} (${detailMsg})`
    if (json.error) return json.error
    return "요청 처리에 실패했습니다."
  } catch {
    const text = await res.text().catch(() => "")
    return text || "요청 처리에 실패했습니다."
  }
}

const DashboardFarmsPage: React.FC = () => {
  const [farms, setFarms] = React.useState<Farm[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const fetchFarms = React.useCallback(async (options?: { initial?: boolean }) => {
    const isInitial = options?.initial ?? false
    if (isInitial) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch("/api/farms", {
        method: "GET",
        credentials: "include",
      })
      const json = (await res.json()) as {
        farms?: Farm[]
        error?: string
        details?: string
      }

      if (!res.ok) {
        const msg = json.details
          ? `${json.error ?? "오류"} (${json.details})`
          : json.error ?? "목록을 불러오지 못했습니다."
        if (isInitial) setError(msg)
        return
      }

      setFarms(json.farms ?? [])
      if (isInitial) setError(null)
    } catch {
      if (isInitial) {
        setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
        setFarms([])
      }
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchFarms({ initial: true })
  }, [fetchFarms])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateFarmFormValues>({
    resolver: zodResolver(farmUpsertBodySchema),
    defaultValues: {
      name: "",
      description: "",
      location: "",
      area_sqm: "",
    },
  })

  const onSubmit = async (values: CreateFarmFormValues) => {
    try {
      const res = await fetch("/api/farms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          description: values.description ?? "",
          location: values.location ?? "",
          area_sqm: values.area_sqm,
        }),
      })

      if (!res.ok) {
        throw new Error(await parseApiError(res))
      }

      toast.success("농장이 추가되었습니다.")
      reset({ name: "", description: "", location: "", area_sqm: "" })
      await fetchFarms()
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "농장 추가에 실패했습니다.",
      )
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 bg-background px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">농장 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            본인 계정에 등록된 농장만 표시됩니다.
          </p>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/dashboard">대시보드로</Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>등록된 농장</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground" role="status">
                목록을 불러오는 중입니다...
              </p>
            ) : error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : farms.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                등록된 농장이 없습니다. 오른쪽 폼에서 추가해 보세요.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {farms.map((farm) => (
                  <li key={farm.id}>
                    <Link
                      href={`/dashboard/farms/${farm.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{farm.name}</p>
                        <p className="text-xs text-muted-foreground">
                          면적 {farm.area_sqm} ㎡ · 상세 보기
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>농장 추가</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">이름</FieldLabel>
                  <Input
                    id="name"
                    placeholder="예: 온실 A"
                    autoComplete="off"
                    {...register("name")}
                  />
                  {errors.name?.message ? (
                    <FieldError>{errors.name.message}</FieldError>
                  ) : null}
                </Field>

                <Field>
                  <FieldLabel htmlFor="description">설명</FieldLabel>
                  <Input
                    id="description"
                    placeholder="선택 입력"
                    {...register("description")}
                  />
                  <FieldDescription>
                    비워 두면 DB에는 NULL로 저장됩니다.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="location">위치</FieldLabel>
                  <Input
                    id="location"
                    placeholder="선택 입력"
                    {...register("location")}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="area_sqm">면적(㎡)</FieldLabel>
                  <Input
                    id="area_sqm"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="예: 1200"
                    {...register("area_sqm")}
                  />
                  {errors.area_sqm?.message ? (
                    <FieldError>{errors.area_sqm.message}</FieldError>
                  ) : null}
                </Field>
              </FieldGroup>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? "추가 중..." : "농장 추가"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default DashboardFarmsPage
