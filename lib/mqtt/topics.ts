/**
 * MQTT 토픽 allowlist.
 * - 향후 farm_id 기반 토픽으로 확장해도, 서버에서 허용 토픽을 통제한다.
 */
export const MQTT_TOPICS = [
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

export type MQTTTopic = (typeof MQTT_TOPICS)[number]

