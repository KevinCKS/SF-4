-- sensors / sensor_readings 만 깨끗이 제거 후 재생성할 때 사용한다.
-- ⚠️ sensor_readings 에 쌓인 데이터가 모두 삭제된다.
-- 실행 순서: 이 파일 → sensors-table.sql → sensor-readings-table.sql

drop table if exists public.sensor_readings cascade;
drop table if exists public.sensors cascade;
