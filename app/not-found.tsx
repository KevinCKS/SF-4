"use client"

import { CenteredState } from "@/components/common/CenteredState"

/**
 * 404(Not Found) 공통 화면.
 * (onAction 전달을 위해 Client Component — 서버에서 함수 props는 직렬화 불가)
 */
const NotFound = () => {
  return (
    <CenteredState
      variant="info"
      title="페이지를 찾을 수 없습니다."
      description="주소가 올바른지 확인해 주세요."
      actionLabel="로그인으로 이동"
      onAction={() => {
        if (typeof window !== "undefined") window.location.href = "/login"
      }}
    />
  )
}

export default NotFound

