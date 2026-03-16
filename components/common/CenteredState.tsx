"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

/**
 * 로딩/오류/안내 메시지를 중앙 정렬로 표시하는 공통 컴포넌트.
 * 여러 페이지에서 상태 UI를 일관되게 제공하기 위해 사용한다.
 */
export const CenteredState: React.FC<{
  title: string
  description?: string
  variant: "loading" | "error" | "info"
  actionLabel?: string
  onAction?: () => void
}> = ({ title, description, variant, actionLabel, onAction }) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {variant === "loading" ? <Spinner /> : null}
            <span>{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {description ? (
            <p
              className={
                variant === "error"
                  ? "text-sm text-destructive"
                  : "text-sm text-muted-foreground"
              }
              role={variant === "error" ? "alert" : "status"}
            >
              {description}
            </p>
          ) : null}

          {actionLabel && onAction ? (
            <Button className="w-full" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

