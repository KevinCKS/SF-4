export default function HomePage() {
  // / 경로: 미로그인 → middleware에서 /login, 로그인됨 → /dashboard 로 보냄.
  // 미들웨어 matcher 밖 등 예외 시에만 이 화면이 보일 수 있다.
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">페이지를 불러오는 중입니다...</p>
    </div>
  )
}
