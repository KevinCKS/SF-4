/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-require */
/**
 * Supabase `farms` 테이블의 id·이름을 출력한다.
 * - `SUPABASE_SERVICE_ROLE_KEY` 로 조회 (로컬 .env.local)
 * - `npm run list-farms` 또는 `node scripts/list-farms.js`
 */
const fs = require("fs")
const path = require("path")
const { createClient } = require("@supabase/supabase-js")

const loadEnv = (filePath) => {
  try {
    const raw = fs.readFileSync(filePath, "utf8")
    const lines = raw.split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const idx = trimmed.indexOf("=")
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      let value = trimmed.slice(idx + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  } catch {
    // ignore
  }
}

loadEnv(path.join(__dirname, "..", ".env.local"))

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error(
    "[list-farms] NEXT_PUBLIC_SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 필요합니다.",
  )
  process.exit(1)
}

const main = async () => {
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from("farms")
    .select("id, name, created_at")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[list-farms] 조회 오류:", error.message)
    process.exit(1)
  }

  if (!data?.length) {
    console.log("[list-farms] farms 행이 없습니다. 먼저 앱에서 농장을 추가하세요.")
    process.exit(0)
  }

  console.log("[list-farms] 아래 id 를 MQTT_TEST_FARM_ID 로 .env.local 에 넣으세요.\n")
  for (const row of data) {
    console.log(`  name: ${row.name}`)
    console.log(`  id:   ${row.id}\n`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
