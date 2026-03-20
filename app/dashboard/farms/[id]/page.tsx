"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import type { Farm } from "@/types/farm"
import { farmUpsertBodySchema } from "@/lib/validators/farm"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type FarmEditFormValues = z.input<typeof farmUpsertBodySchema>

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

/**
 * 농장 상세·수정·삭제 화면. GET으로 조회, PATCH로 수정, 확인 후 DELETE로 삭제한다. RLS로 본인 데이터만 처리된다. (단계 2.5~2.7)
 */
const FarmDetailPage: React.FC = () => {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === "string" ? params.id : undefined

  const [farm, setFarm] = React.useState<Farm | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  const loadFarm = React.useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/farms/${encodeURIComponent(id)}`, {
        method: "GET",
        credentials: "include",
      })
      const json = (await res.json()) as {
        farm?: Farm
        error?: string
        details?: string
      }

      if (!res.ok) {
        const msg = json.details
          ? `${json.error ?? "오류"} (${json.details})`
          : json.error ?? "농장을 불러오지 못했습니다."
        setFarm(null)
        setError(msg)
        return
      }

      setFarm(json.farm ?? null)
      setError(null)
    } catch {
      setFarm(null)
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
    } finally {
      setLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    if (!id) {
      setLoading(false)
      setError("농장 ID가 없습니다.")
      return
    }
    void loadFarm()
  }, [id, loadFarm])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FarmEditFormValues>({
    resolver: zodResolver(farmUpsertBodySchema),
    defaultValues: {
      name: "",
      description: "",
      location: "",
      area_sqm: "",
    },
  })

  React.useEffect(() => {
    if (!farm) return
    reset({
      name: farm.name,
      description: farm.description ?? "",
      location: farm.location ?? "",
      area_sqm: String(farm.area_sqm),
    })
  }, [farm, reset])

  const formatWhen = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    } catch {
      return iso
    }
  }

  const onSubmit = async (values: FarmEditFormValues) => {
    if (!id) return
    try {
      const res = await fetch(`/api/farms/${encodeURIComponent(id)}`, {
        method: "PATCH",
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

      const json = (await res.json()) as { farm?: Farm }
      if (json.farm) {
        setFarm(json.farm)
        reset({
          name: json.farm.name,
          description: json.farm.description ?? "",
          location: json.farm.location ?? "",
          area_sqm: String(json.farm.area_sqm),
        })
      }
      toast.success("농장 정보가 저장되었습니다.")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "농장 수정에 실패했습니다.",
      )
    }
  }

  const onDelete = async () => {
    if (!id || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/farms/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!res.ok) {
        throw new Error(await parseApiError(res))
      }

      toast.success("농장이 삭제되었습니다.")
      router.replace("/dashboard/farms")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "농장 삭제에 실패했습니다.",
      )
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 bg-background px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">농장 상세</h1>
          {id ? (
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
              {id}
            </p>
          ) : null}
        </div>
        <Button variant="secondary" asChild>
          <Link href="/dashboard/farms">목록으로</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>농장 정보 수정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <p className="text-sm text-muted-foreground" role="status">
              불러오는 중입니다...
            </p>
          ) : error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : farm ? (
            <>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="name">이름</FieldLabel>
                    <Input
                      id="name"
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
                    <Input id="location" {...register("location")} />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="area_sqm">면적(㎡)</FieldLabel>
                    <Input
                      id="area_sqm"
                      type="number"
                      step="0.01"
                      min={0}
                      {...register("area_sqm")}
                    />
                    {errors.area_sqm?.message ? (
                      <FieldError>{errors.area_sqm.message}</FieldError>
                    ) : null}
                  </Field>
                </FieldGroup>

                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? "저장 중..." : "변경 저장"}
                </Button>
              </form>

              <div className="border-t pt-4">
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                  메타 정보
                </h3>
                <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr] sm:gap-x-4">
                  <dt className="text-muted-foreground">등록일</dt>
                  <dd>{formatWhen(farm.created_at)}</dd>
                  <dt className="text-muted-foreground">수정일</dt>
                  <dd>{formatWhen(farm.updated_at)}</dd>
                </dl>
              </div>

              <div className="border-t pt-6">
                <div className="mb-3 text-sm font-medium text-destructive">
                  위험 구역 (삭제)
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full sm:w-auto"
                      disabled={deleting}
                    >
                      {deleting ? "삭제 중..." : "농장 삭제"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        정말로 농장을 삭제할까요?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        연관된 센서/측정 데이터가 함께 삭제될 수 있습니다.
                        이 작업은 되돌릴 수 없습니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleting}>
                        취소
                      </AlertDialogCancel>
                      <AlertDialogAction disabled={deleting} onClick={onDelete}>
                        삭제 확인
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">데이터가 없습니다.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default FarmDetailPage
