import mqtt, { type IClientOptions } from "mqtt"

import { appendMqttLog, getMqttLogMeta } from "@/lib/mqtt/messageLog"
import { getManagerState } from "@/lib/mqtt/runtimeState"
import { getDefaultMqttSubscribeTopics, isAllowedMqttTopic } from "@/lib/mqtt/topics"

const getGlobalState = () => getManagerState()

const readEnv = () => {
  const brokerUrl = process.env.MQTT_BROKER_URL
  const username = process.env.MQTT_USERNAME
  const password = process.env.MQTT_PASSWORD
  const clientId = process.env.MQTT_CLIENT_ID || "smartfarm-web-client"

  return { brokerUrl, username, password, clientId }
}

/**
 * MQTT 서버 전용 연결/발행/상태 관리.
 * - Next.js Route Handler(서버)에서만 사용한다.
 * - 브라우저 direct websocket 연결은 하지 않는다.
 */
export const connectAndInit = async (subscribeTopics?: string[]): Promise<void> => {
  const state = getGlobalState()

  const desiredTopics = subscribeTopics?.length
    ? [...new Set(subscribeTopics.map((t) => t.trim()))]
    : getDefaultMqttSubscribeTopics()

  const allowedDesiredTopics = desiredTopics.filter(isAllowedMqttTopic)
  if (allowedDesiredTopics.length === 0) {
    throw new Error("구독할 토픽이 올바르지 않습니다.")
  }

  // 연결 생성/갱신 동안에도 onConnect에서 최신 값을 참조하도록 유지한다.
  state.latestDesiredTopics = allowedDesiredTopics

  // 이미 연결된 경우에는 “추가로 필요한 토픽만” subscribe 한다.
  if (state.client?.connected) {
    const missing = allowedDesiredTopics.filter((t) => !state.subscribedTopics.includes(t))
    if (missing.length === 0) return

    state.isSubscribing = true
    await Promise.all(
      missing.map(
        (topic) =>
          new Promise<void>((subResolve, subReject) => {
            state.client?.subscribe(topic, { qos: 1 }, (err) => {
              if (err) subReject(err)
              else subResolve()
            })
          }),
      ),
    )

    state.subscribedTopics = [...new Set([...state.subscribedTopics, ...missing])]
    state.isSubscribing = false
    // eslint-disable-next-line no-console
    console.log(`[MQTT] 추가 구독 완료: ${missing.length}개 토픽`)
    return
  }

  if (state.connectingPromise) return state.connectingPromise

  const { brokerUrl, username, password, clientId } = readEnv()

  if (!brokerUrl || !username || !password) {
    throw new Error("MQTT 환경 변수가 설정되지 않았습니다.")
  }

  state.lastConnectError = null
  state.isConnected = false
  state.isSubscribing = false

  state.connectingPromise = new Promise<void>((resolve, reject) => {
    try {
      // 기존 클라이언트가 있으면 정리한다.
      if (state.client) {
        try {
          state.client.removeAllListeners()
          state.client.end(true)
        } catch {
          // ignore
        }
        state.client = null
      }

      const options: IClientOptions = {
        clientId,
        username,
        password,
        clean: true,
        reconnectPeriod: 0, // 자동 재연결 비활성화(수동 제어)
        connectTimeout: 30_000,
        keepalive: 60,
      }

      const client = mqtt.connect(brokerUrl, options)
      state.client = client

      const onConnect = async () => {
        state.isConnected = true
        state.isSubscribing = true
        state.lastConnectError = null

        try {
          const topicsToSubscribe =
            state.latestDesiredTopics.length > 0
              ? state.latestDesiredTopics
              : getDefaultMqttSubscribeTopics()

          // 메시지 처리 등록
          client.on("message", (topic, payload) => {
            const t = topic.toString()
            const raw = payload.toString()
            appendMqttLog(t, raw)
            // 현재는 센서/DB 스키마가 확정되지 않았으므로 일단 로깅만 한다.
            // 다음 단계에서 센서 메타/읽기 테이블에 저장하도록 확장한다.
            try {
              // eslint-disable-next-line no-console
              console.log(`[MQTT] message topic=${t}`, JSON.parse(raw))
            } catch {
              // eslint-disable-next-line no-console
              console.log(`[MQTT] message topic=${t}`, raw)
            }
          })

          // 구독
          await Promise.all(
            topicsToSubscribe.map(
              (topic) =>
                new Promise<void>((subResolve, subReject) => {
                  client.subscribe(topic, { qos: 1 }, (err) => {
                    if (err) subReject(err)
                    else subResolve()
                  })
                }),
            ),
          )

          state.subscribedTopics = [...new Set([...state.subscribedTopics, ...topicsToSubscribe])]
          state.isSubscribing = false
          // eslint-disable-next-line no-console
          console.log(
            `[MQTT] 구독 완료: ${topicsToSubscribe.length}개 토픽 (수신 시 아래에 [MQTT] message 로그가 찍힙니다)`,
          )
          resolve()
        } catch (e) {
          state.isSubscribing = false
          reject(e instanceof Error ? e : new Error("MQTT subscribe 실패"))
        }
      }

      const onError = (err: Error) => {
        state.lastConnectError = err.message
        state.isConnected = false
        state.isSubscribing = false
        state.connectingPromise = null
        reject(err)
      }

      const onClose = () => {
        state.isConnected = false
        state.isSubscribing = false
        // 자동 재연결을 끄고 있으므로 next connectAndInit로 다시 연결한다.
      }

      client.once("connect", onConnect)
      client.once("error", onError)
      client.once("close", onClose)
    } catch (e) {
      state.connectingPromise = null
      reject(e instanceof Error ? e : new Error("MQTT 연결 실패"))
    }
  })

  try {
    await state.connectingPromise
  } finally {
    state.connectingPromise = null
  }
}

/**
 * MQTT 연결 상태 스냅샷.
 * @returns connected — mqtt.js client.connected 기준(브로커와의 소켓 연결 여부)
 */
export const getMqttStatus = () => {
  const state = getGlobalState()
  const { brokerUrl, username, password } = readEnv()
  const envConfigured = Boolean(brokerUrl && username && password)
  // client.connected 가 실제 브로커 연결 여부. isConnected 와 AND 하면
  // 일부 이벤트 순서/close 타이밍에서 불필요하게 false 가 될 수 있어 단일 기준으로 둔다.
  const connected = state.client?.connected === true

  let hint: string | undefined
  if (!connected && envConfigured && !state.client) {
    hint =
      "아직 MQTT 연결을 시도하지 않았습니다. 로그인 후 POST /api/mqtt/connect 를 먼저 호출하세요."
  } else if (!connected && state.lastConnectError) {
    hint = "마지막 연결 시 오류가 있었습니다. lastConnectError 와 서버 로그를 확인하세요."
  }

  const logMeta = getMqttLogMeta()

  return {
    connected,
    envConfigured,
    lastConnectError: state.lastConnectError,
    isSubscribing: state.isSubscribing,
    receivedCount: logMeta.count,
    lastReceivedAt: logMeta.lastReceivedAt,
    ...(hint ? { hint } : {}),
  }
}

/**
 * MQTT 메시지를 발행한다.
 * @param topic 발행 토픽(allowlist 제한)
 * @param message 문자열 payload(JSON 문자열 권장)
 */
export const publishMqtt = async (
  topic: string,
  message: string,
): Promise<void> => {
  await connectAndInit()

  const state = getGlobalState()
  if (!state.client?.connected) {
    throw new Error("MQTT 클라이언트가 연결되어 있지 않습니다.")
  }

  state.client.publish(topic, message, { qos: 1 })
}

