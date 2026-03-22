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
import { LayoutDashboard, List, PlusCircle, Warehouse } from "lucide-react"

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

  // 농장관리 화면 하단의 빈 영역을 “스마트팜 느낌”의 배경으로 채우기 위한 SVG 배경.
  const bgSvg = React.useMemo(
    () => `
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#07131c"/>
      <stop offset="0.55" stop-color="#08222a"/>
      <stop offset="1" stop-color="#051018"/>
    </linearGradient>
    <linearGradient id="m" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#34d399" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#22c55e" stop-opacity="0.0"/>
    </linearGradient>
    <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
  </defs>

  <rect width="1400" height="900" fill="url(#g)"/>

  <!-- 그라데이션 글로우 -->
  <ellipse cx="220" cy="120" rx="340" ry="180" fill="#34d399" opacity="0.18" filter="url(#blur)"/>
  <ellipse cx="1080" cy="280" rx="420" ry="220" fill="#22c55e" opacity="0.10" filter="url(#blur)"/>

  <!-- 온실(프레임) 라인 -->
  <g fill="none" stroke="#34d399" stroke-opacity="0.18" stroke-width="2">
    <path d="M-50 820 C 200 600, 450 520, 700 540 C 980 565, 1200 650, 1450 850" />
    <path d="M-50 760 C 210 560, 470 480, 730 505 C 990 530, 1200 610, 1450 800" />
    <path d="M-50 700 C 210 520, 480 440, 760 465 C 1040 492, 1230 550, 1450 740" />
  </g>

  <!-- 식물 잎(단순 실루엣) -->
  <g fill="#34d399" fill-opacity="0.16">
    <path d="M170 700 C 190 640, 240 620, 260 660 C 230 650, 210 680, 170 700 Z"/>
    <path d="M250 720 C 270 660, 320 640, 340 680 C 310 670, 290 700, 250 720 Z"/>
    <path d="M1220 640 C 1240 590, 1288 570, 1310 610 C 1278 605, 1258 620, 1220 640 Z"/>
    <path d="M1160 700 C 1180 645, 1230 625, 1250 670 C 1215 660, 1195 685, 1160 700 Z"/>
  </g>

  <!-- 민트 수평 스트라이프 -->
  <g opacity="0.12">
    <rect x="0" y="540" width="1400" height="6" fill="url(#m)"/>
    <rect x="0" y="620" width="1400" height="4" fill="url(#m)"/>
    <rect x="0" y="700" width="1400" height="5" fill="url(#m)"/>
  </g>
</svg>
    `,
    [],
  )
  const bgUrl = React.useMemo(() => {
    // encodeURIComponent로 따옴표/특수문자 깨짐을 방지한다.
    const encoded = encodeURIComponent(bgSvg)
    return `url("data:image/svg+xml,${encoded}")`
  }, [bgSvg])

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
    <div className="relative flex min-h-screen w-full flex-col gap-6 bg-background px-6 py-6 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: bgUrl,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.18,
        }}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Warehouse className="size-8 shrink-0 text-primary" aria-hidden />
            농장 관리
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            본인 계정에 등록된 농장만 표시됩니다.
          </p>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/dashboard" className="gap-2">
            <LayoutDashboard className="size-4 shrink-0" aria-hidden />
            대시보드로
          </Link>
        </Button>
        </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <List className="size-5 shrink-0 text-primary" aria-hidden />
              등록된 농장
            </CardTitle>
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
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="size-5 shrink-0 text-primary" aria-hidden />
              농장 추가
            </CardTitle>
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
    </div>
  )
}

export default DashboardFarmsPage
