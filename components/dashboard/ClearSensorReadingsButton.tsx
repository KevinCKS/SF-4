"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"
import { Trash2 } from "lucide-react"

type ClearSensorReadingsButtonProps = {
  /** 지정 시 해당 농장 소속 센서 기록만 삭제한다. 없으면 내 모든 농장 범위. */
  farmId?: string | null
  /** 버튼·다이얼로그 문구용 작은 글자 등 */
  className?: string
}

/**
 * 센서 측정값·알림 로그·액추에이터 제어 기록 삭제를 요청하는 버튼. 확인 후 `POST /api/sensor-readings/clear` 호출.
 */
export const ClearSensorReadingsButton: React.FC<ClearSensorReadingsButtonProps> = ({
  farmId,
  className,
}) => {
  const [open, setOpen] = React.useState(false)
  const [isPending, setIsPending] = React.useState(false)

  const handleConfirm = async () => {
    setIsPending(true)
    try {
      const res = await fetch("/api/sensor-readings/clear", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          farmId ? { farmId } : {},
        ),
        signal:
          typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
            ? AbortSignal.timeout(120_000)
            : undefined,
      })

      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        details?: string
        deletedCount?: number
        alertLogsDeletedCount?: number
        actuatorCommandLogsDeletedCount?: number
        message?: string
      }

      if (!res.ok) {
        if (res.status === 401) {
          toast.error(
            "로그인 세션이 만료되었습니다. 다시 로그인한 뒤 삭제를 시도해 주세요.",
            { duration: 12_000 },
          )
          setOpen(false)
          return
        }
        toast.error(json.error ?? "삭제 요청에 실패했습니다.")
        return
      }

      const n = json.deletedCount ?? 0
      const alertN = json.alertLogsDeletedCount ?? 0
      
      let successMsg = ""
      if (n > 0 && alertN > 0) {
        successMsg = `센서 데이터 ${n.toLocaleString("ko-KR")}건과 알림 로그 ${alertN.toLocaleString("ko-KR")}건을 삭제했습니다.`
      } else if (n > 0) {
        successMsg = `센서 데이터 ${n.toLocaleString("ko-KR")}건을 삭제했습니다.`
      } else if (alertN > 0) {
        successMsg = `알림 로그 ${alertN.toLocaleString("ko-KR")}건을 삭제했습니다.`
      } else {
        successMsg = json.message ?? "삭제할 기록이 없습니다."
      }

      toast.success(successMsg)
      setOpen(false)
    } catch (e) {
      const aborted =
        e instanceof DOMException
          ? e.name === "AbortError"
          : e instanceof Error && e.name === "AbortError"
      if (aborted) {
        toast.error(
          "요청 시간이 초과되었습니다(2분). 서버가 바쁘거나 데이터가 많을 수 있습니다.",
          { duration: 10_000 },
        )
      } else {
        toast.error(
          e instanceof Error ? e.message : "삭제 중 오류가 발생했습니다.",
        )
      }
    } finally {
      setIsPending(false)
    }
  }

  const scopeLabel =
    farmId != null && farmId !== ""
      ? "선택한 농장에 연결된 센서 데이터·알림 로그·제어 기록을"
      : "내 계정 농장에 속한 센서 데이터·알림 로그·제어 기록을"

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="destructive"
          size="default"
          className={cn("gap-1.5 text-[0.7875rem]", className)}
          disabled={isPending}
        >
          <Trash2 className="size-3.5 shrink-0" aria-hidden />
          데이터 비우기
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>데이터 삭제</AlertDialogTitle>
          <AlertDialogDescription className="text-left sm:text-left">
            {scopeLabel} 모두 삭제합니다. 복구할 수 없습니다.
            계속하시겠습니까?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>취소</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(e) => {
              e.preventDefault()
              void handleConfirm()
            }}
            disabled={isPending}
          >
            {isPending ? "삭제 중…" : "삭제"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
