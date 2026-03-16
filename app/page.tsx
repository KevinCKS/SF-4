export default function HomePage() {
  // / 경로는 middleware에서 /login 또는 /dashboard 로 리다이렉트되므로
  // 이 컴포넌트가 실제로 렌더링되는 경우는 거의 없습니다.
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">페이지를 불러오는 중입니다...</p>
    </div>
  )
}
