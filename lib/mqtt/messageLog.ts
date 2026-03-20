/**
 * 서버에서 수신한 MQTT 메시지를 테스트 UI용으로 메모리에 적재한다.
 * - 버퍼는 `runtimeState.ts`의 전역 객체와 동일 배열을 사용한다(API 라우트와 공유).
 */

import { getMqttRuntime, type MqttLogEntry } from "@/lib/mqtt/runtimeState"

export type { MqttLogEntry }

const MAX_ENTRIES = 200

/**
 * 수신 메시지 한 건을 로그 앞쪽에 추가한다.
 */
export const appendMqttLog = (topic: string, payload: string): void => {
  const { receivedMessages: buf } = getMqttRuntime()
  buf.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    receivedAt: new Date().toISOString(),
    topic,
    payload,
  })
  while (buf.length > MAX_ENTRIES) {
    buf.pop()
  }
}

/**
 * 최신 순으로 복사본을 반환한다.
 */
export const getMqttLogs = (): MqttLogEntry[] => [
  ...getMqttRuntime().receivedMessages,
]

/**
 * 로그를 비운다(UI 초기화용).
 */
export const clearMqttLogs = (): void => {
  getMqttRuntime().receivedMessages.length = 0
}

/**
 * 디버그·상태 API용: 수신 건수와 가장 최근 수신 시각(ISO).
 */
export const getMqttLogMeta = (): {
  count: number
  lastReceivedAt: string | null
} => {
  const buf = getMqttRuntime().receivedMessages
  return {
    count: buf.length,
    lastReceivedAt: buf.length > 0 ? buf[0].receivedAt : null,
  }
}
