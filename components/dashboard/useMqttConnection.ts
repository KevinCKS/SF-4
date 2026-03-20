"use client"

import * as React from "react"

import { MQTT_TOPIC_CONFIG_CHANGED_EVENT } from "@/lib/mqtt/topicConfig"

type MqttStatusResponse = {
  connected?: boolean
  envConfigured?: boolean
  lastConnectError?: string | null
  hint?: string
}

/**
 * MQTT 연결 상태(로딩/연결됨/환경설정 여부/오류 메시지)를 공통으로 관리한다.
 * - GET `/api/mqtt/status`로 상태를 조회한다.
 * - POST `/api/mqtt/connect`로 연결·구독을 요청한다.
 * - 토픽 설정 변경 이벤트 발생 시 상태를 자동 새로고침한다.
 */
export const useMqttConnection = () => {
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

  return {
    connected,
    envConfigured,
    lastError,
    setLastError,
    isStatusLoading,
    isConnecting,
    refreshStatus,
    connect,
  }
}

