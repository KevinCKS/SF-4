/**
 * Supabase `sensors` 테이블과 대응하는 타입이다.
 * (단계 5.1 스키마 — docs/sql/sensors-table.sql)
 */
export type Sensor = {
  id: string
  farm_id: string
  name: string
  sensor_type: string
  unit: string | null
  created_at: string
  updated_at: string
}
