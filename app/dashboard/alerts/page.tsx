"use client"

import * as React from "react"
import { toast } from "sonner"

import { useDashboardFarm } from "@/components/dashboard/DashboardFarmContext"
import { FarmActuatorCommandLogsDbTable } from "@/components/dashboard/FarmActuatorCommandLogsDbTable"
import { FarmSensorReadingsTable } from "@/components/dashboard/FarmSensorReadingsTable"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertCircle,
  Bell,
  Cpu,
  Database,
  Inbox,
  Search,
  Trash2,
  Zap,
} from "lucide-react"

type AlertLogApiRow = {
  id: string
  message: string
  created_at: string
  sensor_reading_id: string | null
  alert_setting_id: string
  alert_settings: {
    farm_id: string | null
    sensor_id: string | null
    sensors:
      | { name: string; sensor_type: string }
      | { name: string; sensor_type: string }[]
      | null
  } | null
}

/**
 * DB에 저장된 센서 측정값·제어 기록·알림 이력을 탭으로 조회하는 화면이다.
 * 알림 탭은 행 선택·페이지 이동·선택 삭제를 지원한다.
 */
const DashboardAlertsPage: React.FC = () => {
  const { selectedFarmId, selectedFarm, isLoading: farmLoading } = useDashboardFarm()

  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [q, setQ] = React.useState("")
  const [logs, setLogs] = React.useState<AlertLogApiRow[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [offset, setOffset] = React.useState(0)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set())
  const [deletePending, setDeletePending] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)

  const pageSize = 50

  const buildQuery = React.useCallback(
    (nextOffset: number) => {
      const p = new URLSearchParams()
      if (selectedFarmId) p.set("farmId", selectedFarmId)
      p.set("limit", String(pageSize))
      p.set("offset", String(nextOffset))
      if (dateFrom) {
        const d = new Date(`${dateFrom}T00:00:00`)
        if (!Number.isNaN(d.getTime())) p.set("from", d.toISOString())
      }
      if (dateTo) {
        const d = new Date(`${dateTo}T23:59:59.999`)
        if (!Number.isNaN(d.getTime())) p.set("to", d.toISOString())
      }
      if (q.trim()) p.set("q", q.trim())
      return p.toString()
    },
    [selectedFarmId, dateFrom, dateTo, q],
  )

  const fetchLogs = React.useCallback(
    async (nextOffset: number) => {
      if (!selectedFarmId) return
      setLoading(true)
      setError(null)
      try {
        const loadAt = async (off: number): Promise<void> => {
          const res = await fetch(`/api/alerts/logs?${buildQuery(off)}`, {
            credentials: "include",
            cache: "no-store",
          })
          const json = (await res.json().catch(() => ({}))) as {
            error?: string
            logs?: AlertLogApiRow[]
            total?: number
          }
          if (!res.ok) {
            setError(json.error ?? "알림 이력을 불러오지 못했습니다.")
            setLogs([])
            setTotal(0)
            return
          }
          const list = Array.isArray(json.logs) ? json.logs : []
          const totalVal = typeof json.total === "number" ? json.total : 0
          if (list.length === 0 && off > 0 && totalVal > 0) {
            await loadAt(Math.max(0, off - pageSize))
            return
          }
          setLogs(list)
          setTotal(totalVal)
          setOffset(off)
        }
        await loadAt(nextOffset)
      } catch (e) {
        setError(e instanceof Error ? e.message : "조회 중 오류가 발생했습니다.")
        setLogs([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    },
    [selectedFarmId, buildQuery],
  )

  React.useEffect(() => {
    setSelectedIds(new Set())
  }, [selectedFarmId])

  React.useEffect(() => {
    if (!selectedFarmId || farmLoading) return
    void fetchLogs(0)
    // 농장 전환 시에만 자동 조회. 필터는 「조회」버튼 또는 페이지 이동으로 실행한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFarmId, farmLoading])

  const sensorLabel = (row: AlertLogApiRow): string => {
    const raw = row.alert_settings?.sensors
    const s = Array.isArray(raw) ? raw[0] : raw
    if (s?.name && s?.sensor_type) return `${s.name} (${s.sensor_type})`
    if (row.alert_settings?.sensor_id) return row.alert_settings.sensor_id
    if (row.alert_settings?.farm_id) return "농장 공통"
    return "—"
  }

  const toggleRowId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const headerChecked: boolean | "indeterminate" =
    logs.length > 0 && logs.every((r) => selectedIds.has(r.id))
      ? true
      : logs.some((r) => selectedIds.has(r.id))
        ? "indeterminate"
        : false

  const setPageAllSelected = (select: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (select) {
        logs.forEach((r) => next.add(r.id))
      } else {
        logs.forEach((r) => next.delete(r.id))
      }
      return next
    })
  }

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0
  const currentPage = totalPages > 0 ? Math.floor(offset / pageSize) + 1 : 0

  const visiblePageNumbers = React.useMemo(() => {
    if (totalPages <= 0) return []
    const maxBtn = 7
    if (totalPages <= maxBtn) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    const half = Math.floor(maxBtn / 2)
    let start = Math.max(1, currentPage - half)
    const end = Math.min(totalPages, start + maxBtn - 1)
    start = Math.max(1, end - maxBtn + 1)
    const out: number[] = []
    for (let p = start; p <= end; p++) out.push(p)
    return out
  }, [totalPages, currentPage])

  const hasPrevPage = offset > 0
  const hasNextPage = offset + logs.length < total

  const handleDeleteConfirm = async () => {
    if (!selectedFarmId || selectedIds.size === 0) return
    setDeletePending(true)
    try {
      const res = await fetch("/api/alerts/logs", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmId: selectedFarmId,
          ids: Array.from(selectedIds),
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        deleted?: number
      }
      if (!res.ok) {
        if (res.status === 401) {
          toast.error("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.", {
            duration: 12_000,
          })
          setDeleteDialogOpen(false)
          return
        }
        toast.error(json.error ?? "알림 이력을 삭제하지 못했습니다.")
        return
      }
      const n = json.deleted ?? 0
      toast.success(
        n > 0
          ? `알림 이력 ${n.toLocaleString("ko-KR")}건을 삭제했습니다.`
          : "삭제할 수 있는 항목이 없었습니다.",
      )
      setDeleteDialogOpen(false)
      setSelectedIds(new Set())
      await fetchLogs(offset)
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.",
      )
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <div className="w-full px-6 py-5 md:px-10 md:py-6">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Database className="size-9 shrink-0 text-primary" aria-hidden />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">DB 테이블</h1>
            <p className="text-sm text-muted-foreground">
              센서 등록 정보·장치 제어 기록·알림 내역을 탭으로 나누어 볼 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      {farmLoading ? (
        <Skeleton className="h-10 w-full max-w-md" />
      ) : !selectedFarmId ? (
        <Alert>
          <Inbox className="size-4" aria-hidden />
          <AlertTitle>농장 선택 필요</AlertTitle>
          <AlertDescription>
            좌측 사이드바에서 <strong>현재 농장</strong>을 선택한 뒤 이 페이지를 이용해 주세요.
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue="alerts" className="w-full space-y-5">
          <div className="w-fit max-w-full rounded-2xl border-2 border-primary/35 bg-gradient-to-br from-primary/[0.14] via-card/92 to-primary/[0.06] p-[0.65rem] shadow-[0_12px_40px_-12px_rgba(16,185,129,0.35)] ring-1 ring-inset ring-white/15 backdrop-blur-md sm:p-[0.8125rem]">
            <TabsList className="flex h-auto min-h-[3.9rem] w-auto max-w-full flex-wrap justify-start gap-2 rounded-xl border border-border/60 bg-background/55 p-[0.4875rem] shadow-inner shadow-black/20 dark:bg-background/40">
              <TabsTrigger
                value="sensors"
                className="gap-[0.65rem] rounded-lg px-[1.3rem] py-[0.8125rem] text-[1.3rem] leading-snug font-semibold text-foreground/65 transition-all duration-200 hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/25 data-[state=active]:ring-2 data-[state=active]:ring-primary/45 sm:px-[1.625rem] sm:py-[0.975rem]"
              >
                <Cpu className="size-[1.625rem] shrink-0 sm:size-[1.7875rem]" aria-hidden />
                센서
              </TabsTrigger>
              <TabsTrigger
                value="actuators"
                className="gap-[0.65rem] rounded-lg px-[1.3rem] py-[0.8125rem] text-[1.3rem] leading-snug font-semibold text-foreground/65 transition-all duration-200 hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/25 data-[state=active]:ring-2 data-[state=active]:ring-primary/45 sm:px-[1.625rem] sm:py-[0.975rem]"
              >
                <Zap className="size-[1.625rem] shrink-0 sm:size-[1.7875rem]" aria-hidden />
                액추에이터
              </TabsTrigger>
              <TabsTrigger
                value="alerts"
                className="gap-[0.65rem] rounded-lg px-[1.3rem] py-[0.8125rem] text-[1.3rem] leading-snug font-semibold text-foreground/65 transition-all duration-200 hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/25 data-[state=active]:ring-2 data-[state=active]:ring-primary/45 sm:px-[1.625rem] sm:py-[0.975rem]"
              >
                <Bell className="size-[1.625rem] shrink-0 sm:size-[1.7875rem]" aria-hidden />
                알림 이력
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="sensors" className="mt-0 focus-visible:outline-none">
            <Card className="border-border/80 bg-card/90 shadow-lg shadow-black/25 ring-1 ring-white/10 backdrop-blur-md">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
                  <Cpu className="size-7 shrink-0 text-primary" aria-hidden />
                  센서 측정값
                  {selectedFarm?.name ? (
                    <span className="text-base font-normal text-muted-foreground">
                      · {selectedFarm.name}
                    </span>
                  ) : null}
                </CardTitle>
                <CardDescription>
                  서버에 저장된 센서 읽기 값입니다. 측정 시각 최신 순이며, 페이지당 50건·선택 삭제가 가능합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-5 sm:px-6">
                <FarmSensorReadingsTable farmId={selectedFarmId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actuators" className="mt-0 focus-visible:outline-none">
            <Card className="border-border/80 bg-card/90 shadow-lg shadow-black/25 ring-1 ring-white/10 backdrop-blur-md">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
                  <Zap className="size-7 shrink-0 text-primary" aria-hidden />
                  최근 제어 기록
                  {selectedFarm?.name ? (
                    <span className="text-base font-normal text-muted-foreground">
                      · {selectedFarm.name}
                    </span>
                  ) : null}
                </CardTitle>
                <CardDescription>
                  장치를 켜거나 끌 때 저장되는 기록입니다. 페이지당 50건·선택 삭제가 가능합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-5 sm:px-6">
                <FarmActuatorCommandLogsDbTable farmId={selectedFarmId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="mt-0 focus-visible:outline-none">
            <Card className="border-2 border-primary/30 bg-card/95 shadow-[0_16px_48px_-16px_rgba(16,185,129,0.22)] shadow-black/20 ring-2 ring-primary/15 ring-offset-2 ring-offset-background backdrop-blur-md">
              <CardHeader className="border-b border-primary/15 bg-primary/[0.07] pb-3 pt-4">
                <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/18 ring-1 ring-primary/25">
                    <Bell className="size-5 text-primary" aria-hidden />
                  </span>
                  알림 이력
                  {selectedFarm?.name ? (
                    <span className="text-base font-normal text-muted-foreground">
                      · {selectedFarm.name}
                    </span>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="alert-from">시작일</Label>
                <Input
                  id="alert-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alert-to">종료일</Label>
                <Input
                  id="alert-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2 lg:col-span-2">
                <Label htmlFor="alert-q">메시지 검색</Label>
                <div className="flex gap-2">
                  <Input
                    id="alert-q"
                    placeholder="메시지에 포함된 글자"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0 gap-1"
                    disabled={loading}
                    onClick={() => {
                      setSelectedIds(new Set())
                      void fetchLogs(0)
                    }}
                  >
                    <Search className="size-4" aria-hidden />
                    조회
                  </Button>
                </div>
              </div>
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" aria-hidden />
                <AlertTitle>오류</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : logs.length === 0 ? (
              <Alert>
                <Inbox className="size-4" aria-hidden />
                <AlertTitle>알림이 없습니다</AlertTitle>
                <AlertDescription>
                  선택한 조건에 해당하는 알림 기록이 없습니다. 기간을 넓히거나 검색어를 비워
                  보세요.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {selectedIds.size > 0
                      ? `${selectedIds.size.toLocaleString("ko-KR")}건 선택됨`
                      : "체크박스로 항목을 선택할 수 있습니다."}
                  </p>
                  <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="gap-1"
                        disabled={selectedIds.size === 0 || loading}
                      >
                        <Trash2 className="size-3.5 shrink-0" aria-hidden />
                        선택 삭제
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="sm:max-w-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle>선택한 알림 이력을 삭제할까요?</AlertDialogTitle>
                        <AlertDialogDescription className="text-left sm:text-left">
                          {selectedIds.size.toLocaleString("ko-KR")}건이 영구적으로 삭제됩니다.
                          이 작업은 되돌릴 수 없습니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deletePending}>취소</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          disabled={deletePending}
                          onClick={(e) => {
                            e.preventDefault()
                            void handleDeleteConfirm()
                          }}
                        >
                          {deletePending ? "삭제 중…" : "삭제"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <div className="rounded-md border border-border/80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            aria-label="현재 페이지 전체 선택"
                            checked={headerChecked}
                            onCheckedChange={(v) => {
                              if (v === true) setPageAllSelected(true)
                              else setPageAllSelected(false)
                            }}
                          />
                        </TableHead>
                        <TableHead className="w-12 text-right tabular-nums">순번</TableHead>
                        <TableHead className="w-[11rem]">발생 시각</TableHead>
                        <TableHead className="w-[10rem]">센서·범위</TableHead>
                        <TableHead>메시지</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((row, idx) => (
                        <TableRow key={row.id}>
                          <TableCell className="align-top">
                            <Checkbox
                              aria-label={`알림 선택 ${row.id}`}
                              checked={selectedIds.has(row.id)}
                              onCheckedChange={() => toggleRowId(row.id)}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap align-top text-right text-sm tabular-nums text-muted-foreground">
                            {(offset + idx + 1).toLocaleString("ko-KR")}
                          </TableCell>
                          <TableCell className="whitespace-nowrap align-top text-sm tabular-nums text-muted-foreground">
                            {new Date(row.created_at).toLocaleString("ko-KR", {
                              dateStyle: "short",
                              timeStyle: "medium",
                            })}
                          </TableCell>
                          <TableCell className="align-top text-sm">{sensorLabel(row)}</TableCell>
                          <TableCell className="align-top text-sm leading-snug">
                            {row.message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    전체 {total.toLocaleString("ko-KR")}건
                    {totalPages > 0
                      ? ` · ${totalPages}페이지 중 ${currentPage}페이지`
                      : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading || !hasPrevPage}
                      onClick={() => void fetchLogs(Math.max(0, offset - pageSize))}
                    >
                      이전
                    </Button>
                    <div className="flex flex-wrap gap-1">
                      {visiblePageNumbers.map((p) => (
                        <Button
                          key={p}
                          type="button"
                          variant={p === currentPage ? "default" : "outline"}
                          size="sm"
                          className="min-w-9 px-2"
                          disabled={loading}
                          onClick={() => void fetchLogs((p - 1) * pageSize)}
                        >
                          {p}
                        </Button>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading || !hasNextPage}
                      onClick={() => void fetchLogs(offset + pageSize)}
                    >
                      다음
                    </Button>
                  </div>
                </div>
              </>
            )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

export default DashboardAlertsPage
