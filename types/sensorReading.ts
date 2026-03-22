/**
 * Supabase `sensor_readings` 테이블과 대응하는 타입이다.
 * (단계 5.2 스키마 — docs/sql/sensor-readings-table.sql)
 */
export type SensorReading = {
  id: string
  sensor_id: string
  value: number
  recorded_at: string
  created_at: string
  updated_at: string
}
