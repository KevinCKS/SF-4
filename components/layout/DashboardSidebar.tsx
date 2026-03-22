"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Antenna, LayoutDashboard, Leaf, Warehouse } from "lucide-react"

import { useAuth } from "@/components/auth/AuthProvider"
import { DashboardFarmSelect } from "@/components/dashboard/DashboardFarmSelect"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/**
 * 대시보드 좌측 사이드바. 네비·농장 선택·계정 메뉴를 둔다. (다크 민트 레이아웃)
 */
type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/dashboard/farms", label: "농장 관리", icon: Warehouse },
]

// MQTT 테스트는 개발/디버깅 단계에서만 노출한다.
// (배포 환경에서는 사이드바 메뉴에서 숨김)
const isDev = process.env.NODE_ENV !== "production"
const DEV_ONLY_NAV_ITEMS: NavItem[] = isDev
  ? [{ href: "/dashboard/mqtt-test", label: "MQTT 테스트", icon: Antenna }]
  : []

export const DashboardSidebar: React.FC = () => {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isLoading } = useAuth()

  return (
    <aside className="sticky top-0 z-30 flex h-screen w-[17.5rem] shrink-0 flex-col border-r border-border/60 bg-sidebar/50 px-3 py-5 backdrop-blur supports-[backdrop-filter]:bg-sidebar/40">
      <Link
        href="/dashboard"
        className="mb-5 flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/30"
      >
        <Leaf className="size-9 shrink-0 text-primary" aria-hidden />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-base font-medium uppercase tracking-wider text-muted-foreground">
            Smartfarm
          </span>
          <span className="truncate text-3xl font-semibold text-foreground">
            Web Service
          </span>
        </div>
      </Link>

      {/* 농장 선택: 하단 중복을 없애고 좌측 상단(로고 바로 아래)에만 둔다. */}
      <div className="mb-6 space-y-2 px-0.5">
        <p className="px-2 text-lg font-semibold tracking-tight text-foreground/85">
          현재 농장
        </p>
        <div className="w-full [&_button]:border-sidebar-border/80">
          <DashboardFarmSelect layout="sidebar" />
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1" aria-label="대시보드 메뉴">
        {[...NAV_ITEMS, ...DEV_ONLY_NAV_ITEMS].map(({ href, label, icon: Icon }) => {
          const active =
            href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl border-l-2 border-transparent px-3 py-3 text-xl font-medium transition-colors",
                active
                  ? "border-primary/70 bg-primary/10 text-primary shadow-[0_0_0_1px_rgba(16,185,129,0.15)]"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "size-5 shrink-0 opacity-90",
                  active && "text-primary",
                )}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-4 space-y-4 border-t border-sidebar-border pt-4">
        <div className="px-0.5">
          {isLoading ? (
            <p className="px-2 text-lg text-muted-foreground">인증 확인 중…</p>
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-auto w-full justify-start gap-2 rounded-xl border-sidebar-border bg-card/30 py-3 text-left text-lg backdrop-blur"
                >
                  <span className="truncate">{user.email ?? "계정"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="top"
                className="w-64 text-lg"
              >
                <DropdownMenuLabel className="text-lg font-normal text-muted-foreground">
                  로그인 계정
                </DropdownMenuLabel>
                <DropdownMenuItem disabled className="text-lg">
                  {user.email}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  className="text-lg"
                  onClick={() => router.push("/logout")}
                >
                  로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
