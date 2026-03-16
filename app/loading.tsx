import { CenteredState } from "@/components/common/CenteredState"

/**
 * 앱 전역 로딩 화면.
 * 라우트 전환/데이터 로딩 시 사용자에게 즉시 피드백을 제공한다.
 */
const Loading = () => {
  return (
    <CenteredState
      variant="loading"
      title="불러오는 중입니다..."
      description="잠시만 기다려 주세요."
    />
  )
}

export default Loading

