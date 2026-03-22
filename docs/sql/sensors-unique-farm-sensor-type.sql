-- sensors (farm_id, sensor_type) 유니크 — getOrCreate(upsert) 시 중복 방지
-- 기존 sensors 테이블이 이미 있다면 SQL Editor에서 한 번 실행한다.

create unique index if not exists sensors_farm_id_sensor_type_uidx
  on public.sensors (farm_id, sensor_type);
