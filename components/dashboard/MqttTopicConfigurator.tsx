"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { isAllowedMqttTopic } from "@/lib/mqtt/topics"
import {
  getDefaultMqttTopicConfig,
  getSubscribeTopicsFromConfig,
  MQTT_TOPIC_CONFIG_CHANGED_EVENT,
  setMqttTopicConfig,
  type ActuatorTopicKey,
  type MqttTopicConfig,
  type SensorTopicKey,
} from "@/lib/mqtt/topicConfig"
import { useMqttTopicConfig } from "@/components/dashboard/useMqttTopicConfig"
import { useDashboardFarm } from "@/components/dashboard/DashboardFarmContext"

const SENSOR_UI: Array<{
  key: SensorTopicKey
  label: string
}> = [
  { key: "temperature", label: "온도" },
  { key: "humidity", label: "습도" },
  { key: "ec", label: "EC" },
  { key: "ph", label: "pH" },
]

const ACTUATOR_UI: Array<{
  key: ActuatorTopicKey
  label: string
}> = [
  { key: "led", label: "LED" },
  { key: "pump", label: "Pump" },
  { key: "fan1", label: "FAN 1" },
  { key: "fan2", label: "FAN 2" },
]

/**
 * MQTT 토픽 설정 패널. 아두이노가 하드코딩한 토픽 문자열을 웹에서 맞춘다.
 */
export const MqttTopicConfigurator: React.FC = () => {
  const { selectedFarmId } = useDashboardFarm()
  const config = useMqttTopicConfig(selectedFarmId)
  const [draft, setDraft] = React.useState<MqttTopicConfig>(config)
  const [isApplying, setIsApplying] = React.useState(false)

  React.useEffect(() => {
    setDraft(config)
  }, [config])

  const setSensorTopic = (key: SensorTopicKey, topic: string) => {
    setDraft((prev) => ({
      ...prev,
      sensors: { ...prev.sensors, [key]: topic },
    }))
  }

  const setActuatorTopic = (key: ActuatorTopicKey, topic: string) => {
    setDraft((prev) => ({
      ...prev,
      actuators: { ...prev.actuators, [key]: topic },
    }))
  }

  const handleApply = async () => {
    // 빈 값 또는 prefix가 다른 토픽은 즉시 막는다.
    const allTopics = [
      ...Object.values(draft.sensors),
      ...Object.values(draft.actuators),
    ]
    const invalid = allTopics.filter((t) => !isAllowedMqttTopic(t))
    if (invalid.length > 0) {
      toast.error(`허용되지 않은 토픽이 있습니다: ${invalid[0]}`)
      return
    }

    setIsApplying(true)
    try {
      setMqttTopicConfig(draft, selectedFarmId)
      window.dispatchEvent(new Event(MQTT_TOPIC_CONFIG_CHANGED_EVENT))

      // 이전 로그가 토픽 변경 후 혼동을 줄 수 있으므로 비운다.
      await fetch("/api/mqtt/messages", {
        method: "DELETE",
        credentials: "include",
      }).catch(() => null)

      const topicsToSubscribe = getSubscribeTopicsFromConfig(draft)
      const res = await fetch("/api/mqtt/connect", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: topicsToSubscribe }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof (json as { details?: string }).details === "string"
            ? (json as { details: string }).details
            : "MQTT 토픽 적용에 실패했습니다."
        toast.error(msg)
        return
      }

      toast.success("토픽 설정을 적용하고 서버 구독을 갱신했습니다.")
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <Card className="bg-card/70 backdrop-blur">
      <CardHeader>
        <CardTitle>MQTT 토픽 설정</CardTitle>
        <CardDescription>
          아두이노/기기에서 하드코딩한 토픽 문자열을 웹에서 그대로 입력하세요.
          <span className="text-muted-foreground">
            {" "}
            (토픽을 적용하면 서버가 해당 토픽으로 subscribe 합니다.)
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-medium">센서</p>
            {SENSOR_UI.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-sm">{label}</Label>
                <Input
                  className="font-mono"
                  value={draft.sensors[key]}
                  onChange={(e) => setSensorTopic(key, e.target.value)}
                  placeholder={getDefaultMqttTopicConfig().sensors[key]}
                />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium">액추에이터</p>
            {ACTUATOR_UI.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-sm">{label}</Label>
                <Input
                  className="font-mono"
                  value={draft.actuators[key]}
                  onChange={(e) => setActuatorTopic(key, e.target.value)}
                  placeholder={getDefaultMqttTopicConfig().actuators[key]}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={() => void handleApply()} disabled={isApplying}>
            {isApplying ? "적용 중…" : "토픽 적용(서버 구독 갱신)"}
          </Button>
          <Button
            variant="secondary"
            disabled={isApplying}
            onClick={() => {
              const defaults = getDefaultMqttTopicConfig()
              setDraft(defaults)
              setMqttTopicConfig(defaults, selectedFarmId)
              window.dispatchEvent(new Event(MQTT_TOPIC_CONFIG_CHANGED_EVENT))
              toast.message("기본 토픽으로 되돌렸습니다. '토픽 적용'을 눌러 서버 구독을 갱신하세요.")
            }}
          >
            기본값
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

