"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"

import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

/**
 * 비밀번호 재설정 링크를 이메일로 전송하는 페이지.
 * Supabase Auth의 resetPasswordForEmail 을 호출한다.
 */
const resetSchema = z.object({
  email: z
    .string()
    .min(1, "이메일을 입력해 주세요.")
    .email("올바른 이메일 형식이 아닙니다."),
})

type ResetFormValues = z.infer<typeof resetSchema>

const ForgotPasswordPage: React.FC = () => {
  const router = useRouter()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [infoMessage, setInfoMessage] = React.useState<string | null>(null)
  const [cooldownSeconds, setCooldownSeconds] = React.useState<number>(0)

  React.useEffect(() => {
    if (cooldownSeconds <= 0) return
    const id = window.setInterval(() => {
      setCooldownSeconds((s) => Math.max(0, s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [cooldownSeconds])

  const {
    handleSubmit,
    formState: { errors, isSubmitting },
    register,
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: "",
    },
  })

  const onSubmit = async (values: ResetFormValues) => {
    setServerError(null)
    setInfoMessage(null)

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined

      const { error } = await supabase.auth.resetPasswordForEmail(
        values.email,
        redirectTo ? { redirectTo } : undefined,
      )

      if (error) {
        const status =
          typeof (error as unknown as { status?: number }).status === "number"
            ? (error as unknown as { status?: number }).status
            : undefined

        const isRateLimited =
          status === 429 ||
          error.message?.toLowerCase().includes("rate limit") === true

        if (isRateLimited) {
          setServerError(
            "요청이 너무 많아 잠시 후 다시 시도해 주세요. (이메일 전송 제한)",
          )
          setCooldownSeconds(60)
        } else {
          setServerError(
            error.message ||
              "비밀번호 재설정 메일 전송에 실패했습니다. 다시 시도해 주세요.",
          )
        }

        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.error("비밀번호 재설정 메일 오류:", error)
        }
        return
      }

      const msg =
        "입력하신 이메일 주소로 비밀번호 재설정 링크를 전송했습니다. 메일함을 확인해 주세요."
      setInfoMessage(msg)
      toast.success("비밀번호 재설정 메일을 전송했습니다.")
    } catch (e) {
      setServerError("비밀번호 재설정 중 알 수 없는 오류가 발생했습니다.")
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.error("비밀번호 재설정 예외:", e)
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>비밀번호 재설정</CardTitle>
          <CardDescription>
            계정에 등록된 이메일 주소를 입력하면 비밀번호 재설정 링크를 보내 드립니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">이메일</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-label="이메일"
                  {...register("email")}
                />
                {errors.email?.message ? (
                  <FieldError>{errors.email.message}</FieldError>
                ) : null}
              </Field>
            </FieldGroup>

            {serverError && (
              <p className="text-sm text-destructive" role="alert">
                {serverError}
              </p>
            )}

            {infoMessage && !serverError && (
              <p className="text-sm text-muted-foreground" role="status">
                {infoMessage}
              </p>
            )}

            <FieldDescription>
              메일이 도착하지 않으면 스팸 메일함도 함께 확인해 주세요.
            </FieldDescription>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || cooldownSeconds > 0}
              aria-busy={isSubmitting}
            >
              {isSubmitting
                ? "전송 중입니다..."
                : cooldownSeconds > 0
                  ? `잠시 후 다시 시도해 주세요 (${cooldownSeconds}초)`
                  : "재설정 링크 보내기"}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <div className="flex w-full flex-col items-center gap-2 text-xs text-muted-foreground">
            <button
              type="button"
              className="underline"
              onClick={() => router.push("/login")}
            >
              로그인 페이지로 돌아가기
            </button>
            <button
              type="button"
              className="underline"
              onClick={() => router.push("/signup")}
            >
              아직 계정이 없으신가요? 회원가입 하러 가기
            </button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default ForgotPasswordPage

