"use client"

import * as React from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

/**
 * 대시보드 메인 화면(임시).
 * 이후 센서 게이지/라인 차트, 액추에이터 제어 버튼 등을 이 화면에 구현한다.
 */
const DashboardPage: React.FC = () => {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 bg-background px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>

      <Card>
        <CardHeader>
          <CardTitle>다음 단계</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>- 센서(온도/습도/EC/pH) 게이지 컴포넌트 표시</p>
          <p>- 센서 시계열 라인 차트 표시</p>
          <p>- 액추에이터(LED/Pump/FAN1/FAN2) 제어 버튼 추가</p>
          <p>- MQTT(HiveMQ Cloud) 연결 및 토픽 구독/발행 연동</p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          단계 2.3: 농장 목록은 `/api/farms`에서 `user_id`로 필터해 조회합니다.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/dashboard/mqtt-test">MQTT 테스트 화면</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/farms">농장 목록 보기</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage

