"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
 * 이메일/비밀번호 기반 로그인 페이지 컴포넌트.
 * Supabase Auth를 사용해 사용자를 인증한다.
 */
const loginSchema = z.object({
  email: z
    .string()
    .min(1, "이메일을 입력해 주세요.")
    .email("올바른 이메일 형식이 아닙니다."),
  password: z
    .string()
    .min(6, "비밀번호는 최소 6자 이상이어야 합니다."),
})

type LoginFormValues = z.infer<typeof loginSchema>

const LoginPage: React.FC = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const {
    handleSubmit,
    formState: { errors, isSubmitting },
    register,
    setValue,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  React.useEffect(() => {
    const email = searchParams.get("email")
    if (email) setValue("email", email)
  }, [searchParams, setValue])

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      })

      if (error) {
        setServerError(error.message || "로그인에 실패했습니다. 다시 시도해 주세요.")
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.error("Supabase 로그인 오류:", error)
        }
        return
      }

      if (!data.session) {
        setServerError("세션 정보를 가져오지 못했습니다. 다시 로그인해 주세요.")
        return
      }

      toast.success("로그인에 성공했습니다.")

      const redirectTo = searchParams.get("redirectTo") ?? "/dashboard"
      router.replace(redirectTo)
    } catch (e) {
      setServerError("로그인 중 알 수 없는 오류가 발생했습니다.")
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.error("로그인 예외:", e)
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>로그인</CardTitle>
          <CardDescription>
            스마트팜 웹 서비스에 접속하기 위해 이메일과 비밀번호를 입력해 주세요.
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

              <Field>
                <FieldLabel htmlFor="password">비밀번호</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  placeholder="비밀번호를 입력해 주세요"
                  autoComplete="current-password"
                  aria-label="비밀번호"
                  {...register("password")}
                />
                {errors.password?.message ? (
                  <FieldError>{errors.password.message}</FieldError>
                ) : null}
              </Field>
            </FieldGroup>

            {serverError && (
              <p className="text-sm text-destructive" role="alert">
                {serverError}
              </p>
            )}

            <FieldDescription>
              로그인 후 대시보드에서 센서 상태와 액추에이터를 제어할 수 있습니다.
            </FieldDescription>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "로그인 중입니다..." : "로그인"}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <div className="flex w-full flex-col items-center gap-2 text-xs text-muted-foreground">
            <button
              type="button"
              className="underline"
              onClick={() => router.push("/signup")}
            >
              아직 계정이 없으신가요? 회원가입 하러 가기
            </button>
            <button
              type="button"
              className="underline"
              onClick={() => router.push("/forgot-password")}
            >
              비밀번호를 잊으셨나요? 비밀번호 재설정
            </button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

export default LoginPage

