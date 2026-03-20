/**
 * 서버 기본 subscribe 토픽(기존 데모용).
 * - 향후 UI에서 토픽을 동적으로 받아도, “아무 토픽이나” subscribe/publish 하지는 않도록
 *   prefix 기반 검증을 수행한다.
 */
export const DEFAULT_MQTT_TOPICS = [
  // 센서
  "smartfarm/sensors/temperature",
  "smartfarm/sensors/humidity",
  "smartfarm/sensors/ec",
  "smartfarm/sensors/ph",
  "smartfarm/sensors/all",

  // 액추에이터 제어
  "smartfarm/actuators/led",
  "smartfarm/actuators/pump",
  "smartfarm/actuators/fan1",
  "smartfarm/actuators/fan2",
  "smartfarm/actuators/all",

  // 상태
  "smartfarm/status",
] as const

export const getDefaultMqttSubscribeTopics = (): string[] => [...DEFAULT_MQTT_TOPICS]

/**
 * MQTT 토픽 입력 검증.
 * - 아두이노/모듈이 하드코딩한 토픽 문자열을 UI에서 그대로 넣을 수 있도록,
 *   “smartfarm/” prefix 기반으로 최소한의 안전장치를 둔다.
 */
export const isAllowedMqttTopic = (topic: string): boolean => {
  if (typeof topic !== "string") return false
  const trimmed = topic.trim()
  if (!trimmed) return false
  if (trimmed.length > 200) return false
  if (!trimmed.startsWith("smartfarm/")) return false
  if (/\s/.test(trimmed)) return false
  return true
}

/**
 * legacy 호환(기존 코드에서 MQTTTopic을 사용하던 부분).
 * - 이제는 UI에서 동적 토픽을 허용하므로, 타입은 string으로 둔다.
 */
export type MQTTTopic = string

