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
 * 이메일/비밀번호 기반 회원가입 페이지 컴포넌트.
 * Supabase Auth를 사용해 새 사용자를 등록한다.
 */
const signupSchema = z
  .object({
    email: z
      .string()
      .min(1, "이메일을 입력해 주세요.")
      .email("올바른 이메일 형식이 아닙니다."),
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

type SignupFormValues = z.infer<typeof signupSchema>

const SignupPage: React.FC = () => {
  const router = useRouter()
  const [serverError, setServerError] = React.useState<string | null>(null)
  const [infoMessage, setInfoMessage] = React.useState<string | null>(null)

  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
    register,
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const onSubmit = async (values: SignupFormValues) => {
    setServerError(null)
    setInfoMessage(null)

    try {
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      })

      if (error) {
        setServerError(error.message || "회원가입에 실패했습니다. 다시 시도해 주세요.")
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.error("Supabase 회원가입 오류:", error)
        }
        return
      }

      // 이메일 확인 정책에 따라 세션이 바로 없을 수 있음.
      if (!data.session) {
        setInfoMessage(
          "회원가입이 완료되었습니다. 이메일로 전송된 확인 메일을 확인한 후 다시 로그인해 주세요."
        )
      } else {
        setInfoMessage("회원가입이 완료되었습니다. 이제 로그인하실 수 있습니다.")
      }

      toast.success("회원가입에 성공했습니다.")

      // 잠시 안내를 보여준 뒤 로그인 화면으로 이동
      setTimeout(() => {
        router.replace("/login?email=" + encodeURIComponent(values.email))
      }, 1500)
    } catch (e) {
      setServerError("회원가입 중 알 수 없는 오류가 발생했습니다.")
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.error("회원가입 예외:", e)
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>회원가입</CardTitle>
          <CardDescription>
            스마트팜 웹 서비스를 사용하기 위해 계정을 생성합니다.
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
                <FieldError name="email" control={control} />
              </Field>

              <Field>
                <FieldLabel htmlFor="password">비밀번호</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  placeholder="비밀번호를 입력해 주세요"
                  autoComplete="new-password"
                  aria-label="비밀번호"
                  {...register("password")}
                />
                <FieldError name="password" control={control} />
              </Field>

              <Field>
                <FieldLabel htmlFor="confirmPassword">비밀번호 확인</FieldLabel>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="비밀번호를 한 번 더 입력해 주세요"
                  autoComplete="new-password"
                  aria-label="비밀번호 확인"
                  {...register("confirmPassword")}
                />
                <FieldError name="confirmPassword" control={control} />
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
              회원가입 후 로그인 페이지로 이동하여 서비스를 이용할 수 있습니다.
            </FieldDescription>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "회원가입 중입니다..." : "회원가입"}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            이미 계정이 있으신가요?{" "}
            <button
              type="button"
              className="underline"
              onClick={() => router.push("/login")}
            >
              로그인 하러 가기
            </button>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

export default SignupPage

