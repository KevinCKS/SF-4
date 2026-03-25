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
 * 비밀번호 재설정 페이지.
 * Supabase에서 발송한 재설정 링크를 통해 접근하며, 새 비밀번호를 설정한다.
 */
const resetSchema = z
  .object({
    password: z
      .string()
      .min(6, "비밀번호는 최소 6자 이상이어야 합니다."),
    confirmPassword: z
      .string()
      .min(6, "비밀번호 확인을 입력해 주세요."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "비밀번호가 일치하지 않습니다.",
  })

type ResetFormValues = z.infer<typeof resetSchema>

const ResetPasswordPage: React.FC = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [infoMessage, setInfoMessage] = React.useState<string | null>(null)

  const {
    handleSubmit,
    formState: { errors, isSubmitting },
    register,
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

  const onSubmit = async (values: ResetFormValues) => {
    setServerError(null)
    setInfoMessage(null)

    try {
      // Supabase가 제공한 reset 링크를 통해 들어온 경우,
      // access_token 이 URL fragment 또는 쿼리에 포함되어 세션이 설정된 상태가 된다.
      const { data, error } = await supabase.auth.updateUser({
        password: values.password,
      })

      if (error) {
        setServerError(
          error.message ||
            "비밀번호 재설정에 실패했습니다. 링크가 만료되었을 수 있습니다.",
        )
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.error("비밀번호 재설정 오류:", error)
        }
        return
      }

      if (!data.user) {
        setServerError("사용자 정보를 가져오지 못했습니다. 다시 시도해 주세요.")
        return
      }

      const email =
        data.user.email ?? searchParams.get("email") ?? undefined

      setInfoMessage("비밀번호가 성공적으로 변경되었습니다. 이제 로그인하실 수 있습니다.")
      toast.success("비밀번호가 변경되었습니다.")

      setTimeout(() => {
        if (email) {
          router.replace("/login?email=" + encodeURIComponent(email))
        } else {
          router.replace("/login")
        }
      }, 1500)
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
          <CardTitle>새 비밀번호 설정</CardTitle>
          <CardDescription>
            비밀번호를 재설정하고 새 비밀번호로 로그인할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="password">새 비밀번호</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  placeholder="새 비밀번호를 입력해 주세요"
                  autoComplete="new-password"
                  aria-label="새 비밀번호"
                  {...register("password")}
                />
                {errors.password?.message ? (
                  <FieldError>{errors.password.message}</FieldError>
                ) : null}
              </Field>

              <Field>
                <FieldLabel htmlFor="confirmPassword">
                  새 비밀번호 확인
                </FieldLabel>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="새 비밀번호를 한 번 더 입력해 주세요"
                  autoComplete="new-password"
                  aria-label="새 비밀번호 확인"
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword?.message ? (
                  <FieldError>{errors.confirmPassword.message}</FieldError>
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
              이 페이지는 이메일로 전달된 비밀번호 재설정 링크를 통해서만 접근할 수 있습니다.
            </FieldDescription>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "변경 중입니다..." : "비밀번호 변경하기"}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            문제가 계속된다면, 다시 비밀번호 재설정 메일을 요청해 주세요.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

export default ResetPasswordPage

