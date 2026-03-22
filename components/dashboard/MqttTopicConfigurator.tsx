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
import { mqttTopicPillButtonClassName } from "@/components/dashboard/mqttTopicPillButtonClass"
import { cn } from "@/lib/utils"
import { useMqttTopicConfig } from "@/components/dashboard/useMqttTopicConfig"
import { useDashboardFarm } from "@/components/dashboard/DashboardFarmContext"
import {
  Activity,
  Cpu,
  Droplets,
  Fan,
  Lightbulb,
  PlugZap,
  Radio,
  RotateCcw,
  TestTube,
  Thermometer,
  Zap,
} from "lucide-react"

const SENSOR_UI: Array<{
  key: SensorTopicKey
  label: string
  Icon: typeof Thermometer
}> = [
  { key: "temperature", label: "온도", Icon: Thermometer },
  { key: "humidity", label: "습도", Icon: Droplets },
  { key: "ec", label: "EC", Icon: Activity },
  { key: "ph", label: "pH", Icon: TestTube },
]

const ACTUATOR_UI: Array<{
  key: ActuatorTopicKey
  label: string
  Icon: typeof Lightbulb
}> = [
  { key: "led", label: "LED", Icon: Lightbulb },
  { key: "pump", label: "Pump", Icon: Droplets },
  { key: "fan1", label: "FAN 1", Icon: Fan },
  { key: "fan2", label: "FAN 2", Icon: Fan },
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

    const topicsToSubscribe = getSubscribeTopicsFromConfig(draft)

    setIsApplying(true)
    try {
      // ① 한 번의 API 호출로 서버에서 브로커 연결 + 토픽 구독까지 완료한다.
      // ② 성공한 뒤에만 localStorage 저장·이벤트로 UI 동기화(중간 단계가 보이지 않게).
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
            : "MQTT 브로커 연결 및 토픽 구독에 실패했습니다."
        toast.error(msg)
        return
      }

      setMqttTopicConfig(draft, selectedFarmId)
      window.dispatchEvent(new Event(MQTT_TOPIC_CONFIG_CHANGED_EVENT))

      toast.success("MQTT 브로커 연결과 토픽 구독을 완료했습니다.")
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <Card className="bg-card/70 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Radio className="size-7 shrink-0 text-primary" aria-hidden />
          MQTT 토픽 설정
        </CardTitle>
        <CardDescription className="text-lg leading-relaxed">
          아두이노/기기에서 하드코딩한 토픽 문자열을 웹에서 그대로 입력하세요.
          <span className="text-muted-foreground">
            {" "}
            아래 버튼은 <strong>서버에 한 번만 요청</strong>하여 브로커 연결과 토픽 구독을
            같이 처리합니다.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-xl font-medium">
              <Cpu className="size-5 shrink-0 text-primary/90" aria-hidden />
              센서
            </p>
            {SENSOR_UI.map(({ key, label, Icon }) => (
              <div key={key} className="space-y-1">
                <Label className="flex items-center gap-2 text-xl">
                  <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  {label}
                </Label>
                <Input
                  className="font-mono text-base"
                  value={draft.sensors[key]}
                  onChange={(e) => setSensorTopic(key, e.target.value)}
                  placeholder={getDefaultMqttTopicConfig().sensors[key]}
                />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-xl font-medium">
              <Zap className="size-5 shrink-0 text-primary/90" aria-hidden />
              액추에이터
            </p>
            {ACTUATOR_UI.map(({ key, label, Icon }) => (
              <div key={key} className="space-y-1">
                <Label className="flex items-center gap-2 text-xl">
                  <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  {label}
                </Label>
                <Input
                  className="font-mono text-base"
                  value={draft.actuators[key]}
                  onChange={(e) => setActuatorTopic(key, e.target.value)}
                  placeholder={getDefaultMqttTopicConfig().actuators[key]}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void handleApply()}
            disabled={isApplying}
            className={cn(mqttTopicPillButtonClassName, "gap-2")}
          >
            <PlugZap className="size-4 shrink-0" aria-hidden />
            {isApplying ? "적용 중…" : "브로커 연결 및 토픽 구독"}
          </Button>
          <Button
            variant="secondary"
            className="gap-2 text-lg"
            disabled={isApplying}
            onClick={() => {
              const defaults = getDefaultMqttTopicConfig()
              setDraft(defaults)
              setMqttTopicConfig(defaults, selectedFarmId)
              window.dispatchEvent(new Event(MQTT_TOPIC_CONFIG_CHANGED_EVENT))
              toast.message(
                "기본 토픽으로 되돌렸습니다. '브로커 연결 및 토픽 구독'을 눌러 반영하세요.",
              )
            }}
          >
            <RotateCcw className="size-4 shrink-0" aria-hidden />
            기본값
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

