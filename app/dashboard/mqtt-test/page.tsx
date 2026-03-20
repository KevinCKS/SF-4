"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/** MQTT 테스트 API에서 내려주는 수신 로그 한 건 */
type MqttMessageLog = {
  id: string
  receivedAt: string
  topic: string
  payload: string
}

/** API 공통 오류 본문 파싱 */
const parseJsonError = async (res: Response): Promise<string> => {
  try {
    const j = (await res.json()) as {
      error?: string
      details?: string | unknown
    }
    if (typeof j.details === "string" && j.details.trim()) return j.details
    if (typeof j.error === "string" && j.error.trim()) return j.error
  } catch {
    /* ignore */
  }
  return `요청 실패 (${res.status})`
}

/**
 * HiveMQ 연결·구독 안내·발행·수신 로그를 한 화면에서 테스트한다.
 */
const MqttTestPage: React.FC = () => {
  const [topics, setTopics] = React.useState<string[]>([])
  const [messages, setMessages] = React.useState<MqttMessageLog[]>([])
  const [connected, setConnected] = React.useState(false)
  const [envConfigured, setEnvConfigured] = React.useState<boolean | null>(
    null,
  )
  const [lastError, setLastError] = React.useState<string | null>(null)
  const [isSubscribing, setIsSubscribing] = React.useState(false)
  const [connecting, setConnecting] = React.useState(false)
  const [publishing, setPublishing] = React.useState(false)
  const [loadingLog, setLoadingLog] = React.useState(false)
  const [autoRefresh, setAutoRefresh] = React.useState(true)
  const [selectedTopic, setSelectedTopic] = React.useState<string>("")
  const [publishBody, setPublishBody] = React.useState(
    '{"value":25,"unit":"°C"}',
  )
  const [receivedCount, setReceivedCount] = React.useState(0)
  const [lastReceivedAt, setLastReceivedAt] = React.useState<string | null>(
    null,
  )

  const fetchStatus = React.useCallback(async () => {
    const res = await fetch("/api/mqtt/status", { credentials: "include" })
    if (!res.ok) {
      setConnected(false)
      setLastError(await parseJsonError(res))
      return
    }
    const data = (await res.json()) as {
      connected?: boolean
      envConfigured?: boolean
      lastConnectError?: string | null
      isSubscribing?: boolean
      receivedCount?: number
      lastReceivedAt?: string | null
    }
    setConnected(Boolean(data.connected))
    setEnvConfigured(
      typeof data.envConfigured === "boolean" ? data.envConfigured : null,
    )
    setLastError(data.lastConnectError ?? null)
    setIsSubscribing(Boolean(data.isSubscribing))
    setReceivedCount(
      typeof data.receivedCount === "number" ? data.receivedCount : 0,
    )
    setLastReceivedAt(
      typeof data.lastReceivedAt === "string" ? data.lastReceivedAt : null,
    )
  }, [])

  const fetchMessages = React.useCallback(async () => {
    setLoadingLog(true)
    try {
      const res = await fetch("/api/mqtt/messages", {
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) {
        toast.error(await parseJsonError(res))
        return
      }
      const data = (await res.json()) as {
        topics?: string[]
        messages?: MqttMessageLog[]
      }
      if (Array.isArray(data.topics)) {
        setTopics(data.topics)
        setSelectedTopic((prev) =>
          prev && data.topics!.includes(prev)
            ? prev
            : (data.topics![0] ?? ""),
        )
      }
      if (Array.isArray(data.messages)) setMessages(data.messages)
    } finally {
      setLoadingLog(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchStatus()
    void fetchMessages()
  }, [fetchStatus, fetchMessages])

  React.useEffect(() => {
    if (!autoRefresh) return
    const id = window.setInterval(() => {
      void fetchStatus()
      void fetchMessages()
    }, 2000)
    return () => window.clearInterval(id)
  }, [autoRefresh, fetchStatus, fetchMessages])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const res = await fetch("/api/mqtt/connect", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof (json as { details?: string }).details === "string"
            ? (json as { details: string }).details
            : await parseJsonError(res)
        toast.error(msg)
        return
      }
      toast.success("MQTT 연결·구독 등록을 요청했습니다.")
      await fetchStatus()
      await fetchMessages()
    } finally {
      setConnecting(false)
    }
  }

  const handlePublish = async () => {
    if (!selectedTopic) {
      toast.error("토픽을 선택해 주세요.")
      return
    }
    const message = publishBody.trim()
    if (!message) {
      toast.error("보낼 메시지를 입력해 주세요.")
      return
    }
    setPublishing(true)
    try {
      const res = await fetch("/api/mqtt/publish", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: selectedTopic, message }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof (json as { details?: string }).details === "string"
            ? (json as { details: string }).details
            : await parseJsonError(res)
        toast.error(msg)
        return
      }
      toast.success("메시지를 발행했습니다.")
      await fetchStatus()
      await fetchMessages()
    } finally {
      setPublishing(false)
    }
  }

  const handleClearLog = async () => {
    const res = await fetch("/api/mqtt/messages", {
      method: "DELETE",
      credentials: "include",
    })
    if (!res.ok) {
      toast.error(await parseJsonError(res))
      return
    }
    setMessages([])
    toast.message("수신 로그를 비웠습니다.")
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 bg-background px-4 py-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">MQTT 테스트</h1>
          <p className="text-sm text-muted-foreground">
            서버가 브로커에 붙은 뒤 허용 토픽을 구독하고, 여기서 발행·수신을
            확인합니다.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard">대시보드로</Link>
        </Button>
      </div>

      <Alert>
        <AlertTitle>구독은 자동입니다</AlertTitle>
        <AlertDescription className="text-sm">
          「브로커에 연결」을 누르면 서버가 미리 정해 둔 모든 허용 토픽을 한꺼번에
          구독합니다. 아래 목록은 그 &quot;구독 대상&quot; 안내입니다(MQTTX 등
          외부에서 같은 토픽으로 보내면 수신 로그에 나타납니다).
        </AlertDescription>
      </Alert>

      <Alert>
        <AlertTitle>HiveMQ에서 보냈는데 여기가 비어 있을 때</AlertTitle>
        <AlertDescription className="space-y-2 text-sm">
          <p>
            <strong>같은 클러스터인지</strong> 확인하세요. HiveMQ Cloud 콘솔에서
            확인하는 호스트·웹소켓 포트(예: 8884)가 <code>.env.local</code>의{" "}
            <code>MQTT_BROKER_URL</code> 과 같은 클러스터여야 합니다. 웹 클라이언트만
            열었을 때 <strong>다른 데모/기본 브로커</strong>에 붙어 있으면 메시지가
            절대 오지 않습니다.
          </p>
          <p>
            메시지 보내는 <strong>순간</strong> 이 화면이 <strong>연결됨</strong>
            이어야 합니다. <code>npm run dev</code> 터미널에{" "}
            <code>[MQTT] message topic=...</code> 가 찍히면 브로커→서버 수신은 된
            것입니다(찍히는데 목록만 비면 새로고침·로그 API 문제).
          </p>
          <p>
            <code>MQTT_CLIENT_ID</code> 는 브로커에 동시에 하나만 붙을 수 있습니다.
            PC의 MQTTX·아두이노·이 웹앱이 <strong>같은 ID</strong>를 쓰면 서로 밀어내
            연결이 끊길 수 있습니다. 필요하면 ID를 바꿔 보세요.
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              연결 상태
              <Badge variant={connected ? "default" : "secondary"}>
                {connected ? "연결됨" : "미연결"}
              </Badge>
              {isSubscribing ? (
                <Badge variant="outline">구독 처리 중</Badge>
              ) : null}
            </CardTitle>
            <CardDescription>
              {envConfigured === false
                ? ".env에 MQTT_BROKER_URL / MQTT_USERNAME / MQTT_PASSWORD 를 설정하세요."
                : "브로커와의 연결은 이 PC에서 돌아가는 Next 서버 한 프로세스 기준입니다."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {lastError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {lastError}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              서버 수신 버퍼: <strong>{receivedCount}</strong>건
              {lastReceivedAt
                ? ` · 최근 수신: ${new Date(lastReceivedAt).toLocaleString("ko-KR")}`
                : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void handleConnect()}
                disabled={connecting}
              >
                {connecting ? "연결 중…" : "브로커에 연결"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void fetchStatus()
                  void fetchMessages()
                }}
              >
                상태·로그 새로고침
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
              <Label htmlFor="auto-refresh" className="text-sm font-normal">
                2초마다 자동 새로고침
              </Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>구독 대상 토픽</CardTitle>
            <CardDescription>
              연결 성공 후 서버가 구독하는 토픽 목록입니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 rounded-md border p-3">
              <ul className="space-y-1 font-mono text-xs">
                {topics.length === 0 ? (
                  <li className="text-muted-foreground">
                    목록을 불러오는 중이거나 비어 있습니다.
                  </li>
                ) : (
                  topics.map((t) => (
                    <li key={t}>{t}</li>
                  ))
                )}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>메시지 보내기 (발행)</CardTitle>
          <CardDescription>
            허용된 토픽만 선택할 수 있습니다. JSON 문자열을 권장합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>토픽</Label>
            <Select
              value={selectedTopic || undefined}
              onValueChange={setSelectedTopic}
            >
              <SelectTrigger className="w-full max-w-xl">
                <SelectValue placeholder="토픽 선택" />
              </SelectTrigger>
              <SelectContent>
                {topics.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mqtt-payload">메시지 본문</Label>
            <Textarea
              id="mqtt-payload"
              className="font-mono text-sm"
              rows={4}
              value={publishBody}
              onChange={(e) => setPublishBody(e.target.value)}
            />
          </div>
          <Button onClick={() => void handlePublish()} disabled={publishing}>
            {publishing ? "발행 중…" : "이 토픽으로 발행"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>받은 메시지</CardTitle>
            <CardDescription>
              서버가 구독 중인 토픽으로 들어온 내용이 시간 순으로 쌓입니다.
              {loadingLog ? " (불러오는 중…)" : ""}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void handleClearLog()}>
            로그 비우기
          </Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-80 rounded-md border">
            <div className="space-y-2 p-3">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  아직 수신 기록이 없습니다. 연결 후 MQTTX로 같은 토픽에
                  발행해 보거나, 위에서 발행해 보세요(일부 브로커는 같은 클라이언트
                  자전 수신을 막을 수 있습니다).
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-mono text-xs font-medium text-primary">
                        {m.topic}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(m.receivedAt).toLocaleString("ko-KR")}
                      </span>
                    </div>
                    <pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs">
                      {m.payload}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

export default MqttTestPage
