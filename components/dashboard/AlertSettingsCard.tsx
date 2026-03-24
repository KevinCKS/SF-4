"use client"

import * as React from "react"
import {
  Plus,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Settings2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useDashboardFarm } from "@/components/dashboard/DashboardFarmContext"
import { SENSOR_SECTION_SURFACE_CLASS } from "@/components/dashboard/sensorSectionSurface"
import { cn } from "@/lib/utils"

interface AlertSetting {
  id?: string
  farm_id: string
  sensor_id: string | null
  min_value: number | null
  max_value: number | null
  notify_email: string
  is_active: boolean
  sensor?: {
    id: string
    name: string
    sensor_type: string
  }
}

type AlertSettingsCardProps = {
  /** 바깥 컨테이너에 덧씌울 클래스(선택) */
  className?: string
}

/**
 * 농장/센서별 알림 임계치 설정 카드 컴포넌트
 */
export const AlertSettingsCard: React.FC<AlertSettingsCardProps> = ({
  className,
}) => {
  const { selectedFarmId, selectedFarm } = useDashboardFarm()
  const [settings, setSettings] = React.useState<AlertSetting[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  // 센서 목록 (농장 선택 시 로드)
  const [availableSensors, setAvailableSensors] = React.useState<any[]>([])

  const fetchSettings = React.useCallback(async () => {
    if (!selectedFarmId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/alerts/settings?farmId=${selectedFarmId}`)
      if (!res.ok) throw new Error("알림 설정을 불러오지 못했습니다.")
      const data = await res.json()
      setSettings(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedFarmId])

  const fetchSensors = React.useCallback(async () => {
    if (!selectedFarmId) return
    try {
      const res = await fetch(`/api/sensors?farmId=${selectedFarmId}`)
      if (!res.ok) throw new Error("센서 목록을 불러오지 못했습니다.")
      const data = await res.json()
      setAvailableSensors(data)
    } catch (err: any) {
      console.error(err.message)
    }
  }, [selectedFarmId])

  React.useEffect(() => {
    if (selectedFarmId) {
      fetchSettings()
      fetchSensors()
    }
  }, [selectedFarmId, fetchSettings, fetchSensors])

  const handleAddSetting = () => {
    if (!selectedFarmId) return
    const newSetting: AlertSetting = {
      farm_id: selectedFarmId,
      sensor_id: null,
      min_value: null,
      max_value: null,
      notify_email: "",
      is_active: true,
    }
    setSettings([newSetting, ...settings])
  }

  const handleSave = async (setting: AlertSetting) => {
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch("/api/alerts/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setting),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "저장에 실패했습니다.")
      }
      setSuccess("알림 설정이 저장되었습니다.")
      fetchSettings()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDelete = async (id?: string, index?: number) => {
    if (!id) {
      // 아직 저장되지 않은 행 삭제
      const newSettings = [...settings]
      newSettings.splice(index!, 1)
      setSettings(newSettings)
      return
    }

    if (!confirm("정말 삭제하시겠습니까?")) return

    try {
      const res = await fetch(`/api/alerts/settings?id=${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("삭제에 실패했습니다.")
      setSuccess("알림 설정이 삭제되었습니다.")
      fetchSettings()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const updateLocalSetting = (index: number, field: keyof AlertSetting, value: any) => {
    const newSettings = [...settings]
    newSettings[index] = { ...newSettings[index], [field]: value }
    setSettings(newSettings)
  }

  if (!selectedFarmId) return null

  return (
    <div className={cn(SENSOR_SECTION_SURFACE_CLASS, className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
            <Settings2 className="size-4 shrink-0 text-primary" aria-hidden />
            알림 임계치 설정
          </p>
          <p className="text-sm text-muted-foreground">
            {selectedFarm?.name}의 센서별 알림 조건을 설정합니다.
          </p>
        </div>
        <Button
          type="button"
          onClick={handleAddSetting}
          size="sm"
          variant="secondary"
          className="shrink-0 gap-1"
        >
          <Plus className="size-4" aria-hidden />
          설정 추가
        </Button>
      </div>

      <div className="mt-4 space-y-4">

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>오류</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {success ? (
        <Alert className="border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400">
          <CheckCircle2 className="size-4" />
          <AlertTitle>성공</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}

      {loading && settings.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : settings.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
          설정된 알림이 없습니다. '설정 추가' 버튼을 눌러보세요.
        </div>
      ) : (
        <div className="space-y-4">
          {settings.map((setting, index) => (
            <div
              key={setting.id || `new-${index}`}
              className="p-4 rounded-lg border bg-background/50 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <Label>센서 선택</Label>
                  <Select
                    value={setting.sensor_id || "all"}
                    onValueChange={(val) =>
                      updateLocalSetting(index, "sensor_id", val === "all" ? null : val)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="센서 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">농장 전체 (공통)</SelectItem>
                      {availableSensors.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.sensor_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>하한값 (Min)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="미설정"
                    value={setting.min_value ?? ""}
                    onChange={(e) =>
                      updateLocalSetting(
                        index,
                        "min_value",
                        e.target.value === "" ? null : parseFloat(e.target.value)
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>상한값 (Max)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="미설정"
                    value={setting.max_value ?? ""}
                    onChange={(e) =>
                      updateLocalSetting(
                        index,
                        "max_value",
                        e.target.value === "" ? null : parseFloat(e.target.value)
                      )
                    }
                  />
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <div className="flex items-center gap-2 mr-4">
                    <Label className="text-xs">활성화</Label>
                    <Switch
                      checked={setting.is_active}
                      onCheckedChange={(val) => updateLocalSetting(index, "is_active", val)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleSave(setting)}
                    title="저장"
                  >
                    <Save className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(setting.id, index)}
                    title="삭제"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>알림 이메일 (선택)</Label>
                  <Input
                    type="email"
                    placeholder="example@email.com"
                    value={setting.notify_email || ""}
                    onChange={(e) => updateLocalSetting(index, "notify_email", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
