import type { MqttClient } from "mqtt"

/**
 * 수신 로그 한 건(테스트 UI·API용).
 */
export type MqttLogEntry = {
  id: string
  receivedAt: string
  topic: string
  payload: string
}

/**
 * MQTT 매니저 + 수신 로그를 한 global 객체에 둔다.
 * - Turbopack/번들이 나뉘어도 process의 globalThis 는 하나이므로 API 라우트와 동일 버퍼를 공유한다.
 */

export type MQTTManagerState = {
  client: MqttClient | null
  connectingPromise: Promise<void> | null
  isConnected: boolean
  isSubscribing: boolean
  lastConnectError: string | null
  /**
   * 가장 최근 connect 요청에서 프론트가 의도한 구독 대상 토픽 목록.
   * 연결이 갱신/생성되는 동안에도 유지되어 onConnect에서 사용된다.
   */
  latestDesiredTopics: string[]
  /**
   * 실제로 서버가 이미 subscribe 해 둔 토픽 목록(되도록 union).
   */
  subscribedTopics: string[]
}

export type SmartfarmMqttRuntime = {
  manager: MQTTManagerState
  receivedMessages: MqttLogEntry[]
}

const GLOBAL_KEY = "__smartfarmMqttRuntime" as const

/**
 * 프로세스 전역 MQTT 런타임(연결 상태 + 수신 로그 버퍼).
 */
export const getMqttRuntime = (): SmartfarmMqttRuntime => {
  const g = globalThis as unknown as Record<
    string,
    SmartfarmMqttRuntime | undefined
  >

  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      manager: {
        client: null,
        connectingPromise: null,
        isConnected: false,
        isSubscribing: false,
        lastConnectError: null,
        latestDesiredTopics: [],
        subscribedTopics: [],
      },
      receivedMessages: [],
    }
  }

  return g[GLOBAL_KEY]!
}

/**
 * MQTT 클라이언트 연결 상태만 참조한다.
 */
export const getManagerState = (): MQTTManagerState => getMqttRuntime().manager
