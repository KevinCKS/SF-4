/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-require-imports */
/* MQTT Sensor test: 2초마다 더미 센서 데이터를 발행한다. */

const fs = require("fs")
const path = require("path")
const mqtt = require("mqtt")

const loadEnv = (filePath) => {
  try {
    const raw = fs.readFileSync(filePath, "utf8")
    const lines = raw.split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (trimmed.startsWith("#")) continue
      const idx = trimmed.indexOf("=")
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      let value = trimmed.slice(idx + 1).trim()
      // 따옴표 제거
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  } catch {
    // ignore: .env.local이 없어도 env 변수만 있으면 동작
  }
}

// 프로젝트 루트 기준 .env.local 로드
loadEnv(path.join(__dirname, "..", ".env.local"))

const brokerUrl = process.env.MQTT_BROKER_URL
const username = process.env.MQTT_USERNAME
const password = process.env.MQTT_PASSWORD

if (!brokerUrl || !username || !password) {
  console.error(
    "[MQTT SENSOR TEST] MQTT_BROKER_URL / MQTT_USERNAME / MQTT_PASSWORD 를 설정해 주세요.",
  )
  process.exit(1)
}

const topics = {
  // 대시보드(UI)에서 설정한 토픽과 동일하게 맞춘다.
  temperature: "smartfarm/class11/sensor/temperature",
  humidity: "smartfarm/class11/sensor/humidity",
  ec: "smartfarm/class11/sensor/ec",
  // UI에서 pH 항목이 /h 로 들어가 있던 것으로 보여서 동일하게 맞춘다.
  ph: "smartfarm/class11/sensor/ph",
}

// 동일 브로커에 다른 클라이언트가 이미 같은 clientId를 쓰면 연결이 밀릴 수 있음.
// 기본적으로 웹앱 clientId 뒤에 suffix를 붙여 충돌을 피한다.
const clientId =
  process.env.MQTT_SENSOR_TEST_CLIENT_ID ||
  `${process.env.MQTT_CLIENT_ID || "smartfarm-web-client"}-sensor-test-${process.pid}`

const clamp = (n, min, max) => Math.max(min, Math.min(max, n))
const noise = (scale) => (Math.random() - 0.5) * scale

const client = mqtt.connect(brokerUrl, {
  clientId,
  username,
  password,
  clean: true,
  reconnectPeriod: 0, // 테스트는 명확성을 위해 자동 재연결 끔
  connectTimeout: 10_000,
  keepalive: 60,
})

let intervalId = null
let startAt = Date.now()

client.on("connect", () => {
  console.log(`[MQTT SENSOR TEST] connected: ${clientId}`)
  console.log(`[MQTT SENSOR TEST] publishing topics:`, topics)

  startAt = Date.now()
  if (intervalId) clearInterval(intervalId)

  intervalId = setInterval(() => {
    const t = Date.now() - startAt

    // 2초마다 “그럴듯한” 변화 패턴 생성
    // (min/max는 UI의 대략적 범위에 맞추되, 값이 완벽히 일치할 필요는 없음)
    const temperature = clamp(25 + 4 * Math.sin(t / 15_000) + noise(0.6), 0, 50)
    const humidity = clamp(60 + 18 * Math.sin(t / 18_000 + 1.1) + noise(1.2), 0, 100)
    const ec = clamp(1.7 + 0.8 * Math.sin(t / 20_000 + 0.3) + noise(0.08), 0, 6)
    const ph = clamp(6.6 + 1.0 * Math.sin(t / 22_000 - 0.4) + noise(0.1), 0, 14)

    const payloads = {
      temperature: JSON.stringify({ value: Number(temperature.toFixed(2)) }),
      humidity: JSON.stringify({ value: Number(humidity.toFixed(2)) }),
      ec: JSON.stringify({ value: Number(ec.toFixed(3)) }),
      ph: JSON.stringify({ value: Number(ph.toFixed(2)) }),
    }

    // Promise 없이 “전송 요청만” 보낸다(테스트 목적)
    client.publish(topics.temperature, payloads.temperature, { qos: 1 })
    client.publish(topics.humidity, payloads.humidity, { qos: 1 })
    client.publish(topics.ec, payloads.ec, { qos: 1 })
    client.publish(topics.ph, payloads.ph, { qos: 1 })

    console.log(
      `[MQTT SENSOR TEST] publish temp=${temperature.toFixed(2)}C, hum=${humidity.toFixed(2)}%, ec=${ec.toFixed(
        3,
      )}, ph=${ph.toFixed(2)}`,
    )
  }, 2000)
})

client.on("error", (err) => {
  console.error("[MQTT SENSOR TEST] error:", err?.message || err)
})

const stop = () => {
  if (intervalId) clearInterval(intervalId)
  intervalId = null
  try {
    client.end(true)
  } catch {
    // ignore
  }
  console.log("[MQTT SENSOR TEST] stopped")
  process.exit(0)
}

process.on("SIGINT", stop)
process.on("SIGTERM", stop)

