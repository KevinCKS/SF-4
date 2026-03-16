import { CenteredState } from "@/components/common/CenteredState"

/**
 * 404(Not Found) 공통 화면.
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

