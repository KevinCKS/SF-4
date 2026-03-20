export type SensorTopicKey = "temperature" | "humidity" | "ec" | "ph"
export type ActuatorTopicKey = "led" | "pump" | "fan1" | "fan2"

export type MqttTopicConfig = {
  version: 1
  sensors: Record<SensorTopicKey, string>
  actuators: Record<ActuatorTopicKey, string>
}

export const MQTT_TOPIC_CONFIG_CHANGED_EVENT = "smartfarm:mqttTopicConfigChanged"
const STORAGE_KEY_BASE = "smartfarm:mqttTopicConfig:v1"

const getStorageKey = (farmId: string | null | undefined): string =>
  farmId ? `${STORAGE_KEY_BASE}:${farmId}` : STORAGE_KEY_BASE

export const getDefaultMqttTopicConfig = (): MqttTopicConfig => ({
  version: 1,
  sensors: {
    temperature: "smartfarm/sensors/temperature",
    humidity: "smartfarm/sensors/humidity",
    ec: "smartfarm/sensors/ec",
    ph: "smartfarm/sensors/ph",
  },
  actuators: {
    led: "smartfarm/actuators/led",
    pump: "smartfarm/actuators/pump",
    fan1: "smartfarm/actuators/fan1",
    fan2: "smartfarm/actuators/fan2",
  },
})

export const getMqttTopicConfig = (farmId?: string | null): MqttTopicConfig => {
  if (typeof window === "undefined") return getDefaultMqttTopicConfig()
  try {
    const raw = window.localStorage.getItem(getStorageKey(farmId))
    if (!raw) return getDefaultMqttTopicConfig()
    const parsed = JSON.parse(raw) as Partial<MqttTopicConfig>
    if (parsed?.version !== 1) return getDefaultMqttTopicConfig()

    const defaults = getDefaultMqttTopicConfig()
    return {
      version: 1,
      sensors: {
        temperature:
          typeof parsed.sensors?.temperature === "string"
            ? parsed.sensors.temperature
            : defaults.sensors.temperature,
        humidity:
          typeof parsed.sensors?.humidity === "string"
            ? parsed.sensors.humidity
            : defaults.sensors.humidity,
        ec: typeof parsed.sensors?.ec === "string" ? parsed.sensors.ec : defaults.sensors.ec,
        ph: typeof parsed.sensors?.ph === "string" ? parsed.sensors.ph : defaults.sensors.ph,
      },
      actuators: {
        led: typeof parsed.actuators?.led === "string" ? parsed.actuators.led : defaults.actuators.led,
        pump:
          typeof parsed.actuators?.pump === "string"
            ? parsed.actuators.pump
            : defaults.actuators.pump,
        fan1:
          typeof parsed.actuators?.fan1 === "string"
            ? parsed.actuators.fan1
            : defaults.actuators.fan1,
        fan2:
          typeof parsed.actuators?.fan2 === "string"
            ? parsed.actuators.fan2
            : defaults.actuators.fan2,
      },
    }
  } catch {
    return getDefaultMqttTopicConfig()
  }
}

export const setMqttTopicConfig = (
  config: MqttTopicConfig,
  farmId?: string | null,
): void => {
  if (typeof window === "undefined") return
  window.localStorage.setItem(getStorageKey(farmId), JSON.stringify(config))
}

export const getSubscribeTopicsFromConfig = (config: MqttTopicConfig): string[] => {
  // 서버 subscribe는 “센서 수신”에만 필요하지만, mqtt-test에서도 확인할 수 있도록 actuator 토픽도 포함한다.
  const topics = [
    config.sensors.temperature,
    config.sensors.humidity,
    config.sensors.ec,
    config.sensors.ph,
    config.actuators.led,
    config.actuators.pump,
    config.actuators.fan1,
    config.actuators.fan2,
    // 기존 동작 호환을 위해 상태 토픽도 함께 subscribe
    "smartfarm/status",
  ]
  return [...new Set(topics)]
}

