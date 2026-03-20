import * as React from "react"

import { getMqttTopicConfig, MQTT_TOPIC_CONFIG_CHANGED_EVENT, type MqttTopicConfig } from "@/lib/mqtt/topicConfig"

/**
 * 토픽 설정(localStorage)을 읽고, “적용” 시점에 변경 이벤트를 통해 동기화한다.
 */
export const useMqttTopicConfig = (farmId?: string | null): MqttTopicConfig => {
  const [config, setConfig] = React.useState<MqttTopicConfig>(() => getMqttTopicConfig(farmId))

  React.useEffect(() => {
    const onChange = () => setConfig(getMqttTopicConfig(farmId))
    window.addEventListener(MQTT_TOPIC_CONFIG_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(MQTT_TOPIC_CONFIG_CHANGED_EVENT, onChange)
  }, [farmId])

  React.useEffect(() => {
    setConfig(getMqttTopicConfig(farmId))
  }, [farmId])

  return config
}

