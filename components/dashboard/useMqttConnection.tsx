"use client"

import * as React from "react"

import { MQTT_TOPIC_CONFIG_CHANGED_EVENT } from "@/lib/mqtt/topicConfig"

type MqttStatusResponse = {
  connected?: boolean
  envConfigured?: boolean
  lastConnectError?: string | null
  hint?: string
}

export type MqttConnectionContextValue = {
  connected: boolean
  envConfigured: boolean | null
  lastError: string | null
  setLastError: React.Dispatch<React.SetStateAction<string | null>>
  isStatusLoading: boolean
  isConnecting: boolean
  isDisconnecting: boolean
  refreshStatus: () => Promise<void>
  connect: (topicsToSubscribe: string[]) => Promise<boolean>
  disconnect: () => Promise<boolean>
}

const MqttConnectionContext = React.createContext<MqttConnectionContextValue | null>(null)

/**
 * 대시보드 트리에서 MQTT 연결 상태를 **한 번만** 보관하고, 하위 페이지·센서·액추가 동일 상태를 본다.
 * (훅을 컴포넌트마다 호출하면 상태가 분리되어 상단은 Connected·카드는 미연결로 어긋난다.)
 */
export const MqttConnectionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const value = useMqttConnectionState()
  return (
    <MqttConnectionContext.Provider value={value}>{children}</MqttConnectionContext.Provider>
  )
}

/**
 * MQTT 연결 상태(로딩/연결됨/환경설정 여부/오류 메시지)를 공통으로 관리한다.
 * - GET `/api/mqtt/status`로 상태를 조회한다.
 * - POST `/api/mqtt/connect`로 연결·구독을 요청한다.
 * - 토픽 설정 변경 이벤트 발생 시 상태를 자동 새로고침한다.
 * @throws MqttConnectionProvider 밖에서 호출하면 오류
 */
export const useMqttConnection = (): MqttConnectionContextValue => {
  const ctx = React.useContext(MqttConnectionContext)
  if (!ctx) {
    throw new Error(
      "useMqttConnection은 MqttConnectionProvider 내부에서만 사용할 수 있습니다.",
    )
  }
  return ctx
}

const useMqttConnectionState = (): MqttConnectionContextValue => {
  const [connected, setConnected] = React.useState(false)
  const [envConfigured, setEnvConfigured] = React.useState<boolean | null>(null)
  const [lastError, setLastError] = React.useState<string | null>(null)
  const [isStatusLoading, setIsStatusLoading] = React.useState(true)
  const [isConnecting, setIsConnecting] = React.useState(false)

  const refreshStatus = React.useCallback(async (): Promise<void> => {
    setIsStatusLoading(true)
    try {
      const res = await fetch("/api/mqtt/status", {
        credentials: "include",
        cache: "no-store",
      })

      if (!res.ok) {
        setConnected(false)
        setLastError(await res.text().catch(() => "MQTT 상태 조회 실패"))
        return
      }

      const data = (await res.json()) as MqttStatusResponse
      setConnected(Boolean(data.connected))
      setEnvConfigured(typeof data.envConfigured === "boolean" ? data.envConfigured : null)
      setLastError(data.lastConnectError ?? data.hint ?? null)
    } catch (e) {
      setConnected(false)
      setLastError(e instanceof Error ? e.message : "MQTT 상태 조회 중 오류가 발생했습니다.")
    } finally {
      setIsStatusLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  React.useEffect(() => {
    const onTopicConfigChange = () => {
      void refreshStatus()
    }
    window.addEventListener(MQTT_TOPIC_CONFIG_CHANGED_EVENT, onTopicConfigChange)
    return () => window.removeEventListener(MQTT_TOPIC_CONFIG_CHANGED_EVENT, onTopicConfigChange)
  }, [refreshStatus])

  const connect = React.useCallback(async (topicsToSubscribe: string[]): Promise<boolean> => {
    setIsConnecting(true)
    setLastError(null)
    try {
      const res = await fetch("/api/mqtt/connect", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: topicsToSubscribe }),
      })

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { details?: string }
        setLastError(j.details ?? "MQTT 연결 실패")
        return false
      }

      await refreshStatus()
      return true
    } catch (e) {
      setLastError(e instanceof Error ? e.message : "MQTT 연결 중 오류가 발생했습니다.")
      return false
    } finally {
      setIsConnecting(false)
    }
  }, [refreshStatus])

  const [isDisconnecting, setIsDisconnecting] = React.useState(false)

  /**
   * 서버 측 MQTT 클라이언트 연결을 해제한다.
   * @returns 연결 해제 API 성공 여부
   */
  const disconnect = React.useCallback(async (): Promise<boolean> => {
    setIsDisconnecting(true)
    setLastError(null)
    try {
      const res = await fetch("/api/mqtt/disconnect", {
        method: "POST",
        credentials: "include",
      })

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { details?: string }
        setLastError(j.details ?? "MQTT 연결 해제 실패")
        return false
      }

      await refreshStatus()
      return true
    } catch (e) {
      setLastError(
        e instanceof Error ? e.message : "MQTT 연결 해제 중 오류가 발생했습니다.",
      )
      return false
    } finally {
      setIsDisconnecting(false)
    }
  }, [refreshStatus])

  return {
    connected,
    envConfigured,
    lastError,
    setLastError,
    isStatusLoading,
    isConnecting,
    isDisconnecting,
    refreshStatus,
    connect,
    disconnect,
  }
}
