"use client"

import * as React from "react"
import Link from "next/link"

import { useDashboardFarm } from "@/components/dashboard/DashboardFarmContext"
import SensorArea from "@/components/dashboard/SensorArea"
import { ActuatorArea } from "@/components/dashboard/ActuatorArea"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * 대시보드 메인: 센서 영역 + 액추에이터 영역 레이아웃. (단계 4.1, 이후 4.2·4.3에서 채움)
 */
const DashboardPage: React.FC = () => {
  const { selectedFarm, isLoading, error, farms } = useDashboardFarm()

  return (
    <div className="w-full px-8 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
        <p className="text-sm text-muted-foreground">
          선택한 농장의 센서와 액추에이터를 한 화면에서 확인합니다.
        </p>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : isLoading && farms.length === 0 ? (
          <Skeleton className="h-4 w-48" />
        ) : selectedFarm ? (
          <p className="text-sm font-medium text-foreground">
            현재 농장: {selectedFarm.name}
          </p>
        ) : farms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            등록된 농장이 없습니다. 농장을 먼저 추가해 주세요.
          </p>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* 단계 4.2: 온도·습도·EC·pH 게이지 + 라인 차트 */}
        <Card className="bg-card/70 backdrop-blur">
          <CardHeader>
            <CardTitle>센서</CardTitle>
            <CardDescription>
              온도, 습도, EC, pH 현재값(게이지)과 최근 시계열(라인 차트)을 이 영역에
              표시합니다. (단계 4.2에서 구현 예정)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SensorArea />
          </CardContent>
        </Card>

        {/* 단계 4.3: LED, Pump, FAN1, FAN2 제어 */}
        <Card className="bg-card/70 backdrop-blur">
          <CardHeader>
            <CardTitle>액추에이터</CardTitle>
            <CardDescription>
              식물성장 LED, 펌프, FAN 1, FAN 2 제어 버튼을 이 영역에 둡니다. (단계
              4.3에서 구현 예정)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActuatorArea />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex flex-col gap-2 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          개발·검증용 링크 (헤더 메뉴에서도 이동 가능)
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard/mqtt-test">MQTT 테스트</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/farms">농장 관리</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
