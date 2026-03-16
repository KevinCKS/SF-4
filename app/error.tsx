"use client"

import * as React from "react"

import { CenteredState } from "@/components/common/CenteredState"

/**
 * 앱 전역 오류 화면.
 * 사용자에게는 한글로 친절한 메시지를 제공하고, 개발 환경에서는 상세 로그를 출력한다.
 */
const ErrorPage: React.FC<{
  error: Error & { digest?: string }
  reset: () => void
}> = ({ error, reset }) => {
  React.useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.error("전역 오류:", error)
    }
  }, [error])

  return (
    <CenteredState
      variant="error"
      title="문제가 발생했습니다."
      description="요청을 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."
      actionLabel="다시 시도"
      onAction={reset}
    />
  )
}

export default ErrorPage

