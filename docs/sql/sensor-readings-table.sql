-- sensor_readings 테이블 생성 및 RLS (implementation-guide 5.2 / memo 단계 5.2)
-- Supabase 대시보드 → SQL Editor에서 실행한다.
-- 선행 조건: public.sensors 테이블이 이미 존재해야 한다 (docs/sql/sensors-table.sql).

-- 1) 테이블
create table if not exists public.sensor_readings (
  id uuid primary key default gen_random_uuid(),
  sensor_id uuid not null references public.sensors (id) on delete cascade,
  value numeric not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sensor_readings is '센서별 시계열 측정값';
comment on column public.sensor_readings.recorded_at is '측정 시각(디바이스·서버 기준은 앱에서 통일)';

-- 2) updated_at 자동 갱신 (public.set_updated_at 는 farms-table.sql 에서 생성됨)
drop trigger if exists sensor_readings_set_updated_at on public.sensor_readings;
create trigger sensor_readings_set_updated_at
  before update on public.sensor_readings
  for each row
  execute procedure public.set_updated_at();

-- 3) RLS — sensor → farm → 본인(user_id = auth.uid())만 접근
alter table public.sensor_readings enable row level security;

drop policy if exists "sensor_readings_select_farm_owner" on public.sensor_readings;
drop policy if exists "sensor_readings_insert_farm_owner" on public.sensor_readings;
drop policy if exists "sensor_readings_update_farm_owner" on public.sensor_readings;
drop policy if exists "sensor_readings_delete_farm_owner" on public.sensor_readings;

create policy "sensor_readings_select_farm_owner"
  on public.sensor_readings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sensors s
      join public.farms f on f.id = s.farm_id
      where s.id = sensor_id
        and f.user_id = auth.uid()
    )
  );

create policy "sensor_readings_insert_farm_owner"
  on public.sensor_readings
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.sensors s
      join public.farms f on f.id = s.farm_id
      where s.id = sensor_id
        and f.user_id = auth.uid()
    )
  );

create policy "sensor_readings_update_farm_owner"
  on public.sensor_readings
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.sensors s
      join public.farms f on f.id = s.farm_id
      where s.id = sensor_id
        and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.sensors s
      join public.farms f on f.id = s.farm_id
      where s.id = sensor_id
        and f.user_id = auth.uid()
    )
  );

create policy "sensor_readings_delete_farm_owner"
  on public.sensor_readings
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.sensors s
      join public.farms f on f.id = s.farm_id
      where s.id = sensor_id
        and f.user_id = auth.uid()
    )
  );

-- 4) 인덱스 — 기간 조회·차트용 (PRD 권장)
create index if not exists sensor_readings_sensor_id_recorded_at_idx
  on public.sensor_readings (sensor_id, recorded_at desc);
