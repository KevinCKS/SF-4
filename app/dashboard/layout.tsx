import { MqttConnectionProvider } from "@/components/dashboard/useMqttConnection"
import { DashboardSidebar } from "@/components/layout/DashboardSidebar"

/**
 * 대시보드: 좌측 사이드바 + 본문 (다크 민트 레이아웃)
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <DashboardSidebar />
      <main className="relative min-h-screen min-w-0 flex-1 overflow-y-auto bg-background">
        {/* 프리미엄 느낌용 배경 라이트 글로우(콘텐츠를 해치지 않도록 pointer-events 비활성) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.28)_0%,_rgba(16,185,129,0.12)_30%,_transparent_62%)]"
        />
        {/* 전체적으로 조금 더 환하게 보이기 위한 아주 약한 화이트 글로우 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_left,_rgba(255,255,255,0.08)_0%,_transparent_60%)]"
        />
        <MqttConnectionProvider>
          <div className="relative">{children}</div>
        </MqttConnectionProvider>
      </main>
    </div>
  )
}
