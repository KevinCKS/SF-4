"use client"

import * as React from "react"
import { toast } from "sonner"

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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertCircle, Trash2 } from "lucide-react"

type ActuatorLogRow = {
  id: string
  farm_id: string
  user_id: string
  actuator_key: string
  topic: string
  payload: string
  success: boolean
  created_at: string
}

type FarmActuatorCommandLogsDbTableProps = {
  /** 조회할 농장 ID */
  farmId: string | null
}

/** 알림 이력·센서 표와 동일한 회색 본문 스타일(text-sm·tabular-nums·muted) */
const mutedRowTextClass =
  "text-sm tabular-nums text-muted-foreground"

const shortUuid = (id: string) => (id.length > 10 ? `${id.slice(0, 8)}…` : id)

const shortPayload = (s: string, max = 40) =>
  s.length <= max ? s : `${s.slice(0, max)}…`

/**
 * 액추에이터 제어 이력(actuator_command_logs)을 표·선택·페이지·삭제로 표시한다.
 */
export const FarmActuatorCommandLogsDbTable: React.FC<
  FarmActuatorCommandLogsDbTableProps
> = ({ farmId }) => {
  const [rows, setRows] = React.useState<ActuatorLogRow[]>([])
  const [total, setTotal] = React.useState(0)
  const [offset, setOffset] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set())
  const [deletePending, setDeletePending] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)

  const pageSize = 50

  const buildQuery = React.useCallback(
    (nextOffset: number) => {
      const p = new URLSearchParams()
      if (farmId) p.set("farmId", farmId)
      p.set("limit", String(pageSize))
      p.set("offset", String(nextOffset))
      return p.toString()
    },
    [farmId],
  )

  const fetchLogs = React.useCallback(
    async (nextOffset: number) => {
      if (!farmId) return
      setLoading(true)
      setError(null)
      try {
        const loadAt = async (off: number): Promise<void> => {
          const res = await fetch(`/api/actuator-commands?${buildQuery(off)}`, {
            credentials: "include",
            cache: "no-store",
          })
          const json = (await res.json().catch(() => ({}))) as {
            error?: string
            logs?: ActuatorLogRow[]
            total?: number
          }
          if (!res.ok) {
            setError(json.error ?? "제어 기록을 불러오지 못했습니다.")
            setRows([])
            setTotal(0)
            return
          }
          const list = Array.isArray(json.logs) ? json.logs : []
          const totalVal = typeof json.total === "number" ? json.total : 0
          if (list.length === 0 && off > 0 && totalVal > 0) {
            await loadAt(Math.max(0, off - pageSize))
            return
          }
          setRows(list)
          setTotal(totalVal)
          setOffset(off)
        }
        await loadAt(nextOffset)
      } catch (e) {
        setError(e instanceof Error ? e.message : "조회 중 오류가 발생했습니다.")
        setRows([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    },
    [farmId, buildQuery],
  )

  React.useEffect(() => {
    setSelectedIds(new Set())
  }, [farmId])

  React.useEffect(() => {
    if (!farmId) {
      setRows([])
      setTotal(0)
      setError(null)
      return
    }
    void fetchLogs(0)
  }, [farmId, fetchLogs])

  const toggleRowId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const headerChecked: boolean | "indeterminate" =
    rows.length > 0 && rows.every((r) => selectedIds.has(r.id))
      ? true
      : rows.some((r) => selectedIds.has(r.id))
        ? "indeterminate"
        : false

  const setPageAllSelected = (select: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (select) {
        rows.forEach((r) => next.add(r.id))
      } else {
        rows.forEach((r) => next.delete(r.id))
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
  const hasNextPage = offset + rows.length < total

  const handleDeleteConfirm = async () => {
    if (!farmId || selectedIds.size === 0) return
    setDeletePending(true)
    try {
      const res = await fetch("/api/actuator-commands", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmId,
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
        toast.error(json.error ?? "제어 기록을 삭제하지 못했습니다.")
        return
      }
      const n = json.deleted ?? 0
      toast.success(
        n > 0
          ? `제어 기록 ${n.toLocaleString("ko-KR")}건을 삭제했습니다.`
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

  if (!farmId) return null

  if (loading && rows.length === 0 && !error) {
    return <Skeleton className="h-44 w-full" />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" aria-hidden />
        <AlertTitle>불러오기 오류</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!loading && rows.length === 0 && total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        저장된 제어 기록이 없습니다. 메인 대시보드에서 장치를 조작하면 기록이 쌓입니다.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-left text-sm text-muted-foreground">
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
              <AlertDialogTitle>선택한 제어 기록을 삭제할까요?</AlertDialogTitle>
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

      <div className="overflow-x-auto rounded-md border border-border/80">
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
              <TableHead className="whitespace-nowrap">기록 시각</TableHead>
              <TableHead className="whitespace-nowrap">장치</TableHead>
              <TableHead className="whitespace-nowrap">토픽</TableHead>
              <TableHead className="whitespace-nowrap">명령</TableHead>
              <TableHead className="whitespace-nowrap">성공</TableHead>
              <TableHead className="whitespace-nowrap">행 id</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, idx) => (
              <TableRow key={r.id}>
                <TableCell className="align-top">
                  <Checkbox
                    aria-label={`제어 기록 선택 ${r.id}`}
                    checked={selectedIds.has(r.id)}
                    onCheckedChange={() => toggleRowId(r.id)}
                  />
                </TableCell>
                <TableCell
                  className={`whitespace-nowrap align-top text-right ${mutedRowTextClass}`}
                >
                  {(offset + idx + 1).toLocaleString("ko-KR")}
                </TableCell>
                <TableCell
                  className={`whitespace-nowrap align-top ${mutedRowTextClass}`}
                >
                  {new Date(r.created_at).toLocaleString("ko-KR", {
                    dateStyle: "short",
                    timeStyle: "medium",
                  })}
                </TableCell>
                <TableCell className="align-top text-sm font-medium">{r.actuator_key}</TableCell>
                <TableCell
                  className={`max-w-[14rem] truncate align-top ${mutedRowTextClass}`}
                  title={r.topic}
                >
                  {r.topic}
                </TableCell>
                <TableCell
                  className={`max-w-[10rem] truncate align-top font-mono ${mutedRowTextClass}`}
                  title={r.payload}
                >
                  {shortPayload(r.payload)}
                </TableCell>
                <TableCell className="align-top">
                  {r.success ? (
                    <Badge variant="default" className="text-xs">
                      예
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">
                      아니오
                    </Badge>
                  )}
                </TableCell>
                <TableCell
                  className={`max-w-[7rem] truncate align-top font-mono ${mutedRowTextClass}`}
                  title={r.id}
                >
                  {shortUuid(r.id)}
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
    </div>
  )
}
