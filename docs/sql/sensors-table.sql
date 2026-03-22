-- sensors 테이블 생성 및 RLS (implementation-guide 5.1 / memo 단계 5.1)
-- Supabase 대시보드 → SQL Editor에서 실행한다.
-- 선행 조건: public.farms 테이블이 이미 존재해야 한다 (docs/sql/farms-table.sql).

-- 1) 테이블
-- sensor_type: temperature, humidity, ec, ph, light, co2, soil_moisture 등 자유 문자열
-- (PRD 확장에 맞춰 애플리케이션·CHECK 제약은 필요 시 추가)
create table if not exists public.sensors (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms (id) on delete cascade,
  name text not null,
  sensor_type text not null,
  unit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sensors is '센서(장비) 메타정보 — 농장(farms)에 소속';
comment on column public.sensors.sensor_type is '센서 종류 식별자 (예: temperature, humidity, ec, ph)';

-- 2) updated_at 자동 갱신 (public.set_updated_at 함수는 farms-table.sql에서 생성됨)
drop trigger if exists sensors_set_updated_at on public.sensors;
create trigger sensors_set_updated_at
  before update on public.sensors
  for each row
  execute procedure public.set_updated_at();

-- 3) RLS — 해당 farm의 소유자(user_id = auth.uid())만 접근
alter table public.sensors enable row level security;

drop policy if exists "sensors_select_farm_owner" on public.sensors;
drop policy if exists "sensors_insert_farm_owner" on public.sensors;
drop policy if exists "sensors_update_farm_owner" on public.sensors;
drop policy if exists "sensors_delete_farm_owner" on public.sensors;

create policy "sensors_select_farm_owner"
  on public.sensors
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.farms f
      where f.id = farm_id
        and f.user_id = auth.uid()
    )
  );

create policy "sensors_insert_farm_owner"
  on public.sensors
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.farms f
      where f.id = farm_id
        and f.user_id = auth.uid()
    )
  );

create policy "sensors_update_farm_owner"
  on public.sensors
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.farms f
      where f.id = farm_id
        and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.farms f
      where f.id = farm_id
        and f.user_id = auth.uid()
    )
  );

create policy "sensors_delete_farm_owner"
  on public.sensors
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.farms f
      where f.id = farm_id
        and f.user_id = auth.uid()
    )
  );

-- 4) 인덱스 — 농장별 센서 목록 조회에 유리
create index if not exists sensors_farm_id_created_at_idx
  on public.sensors (farm_id, created_at desc);

create index if not exists sensors_farm_id_sensor_type_idx
  on public.sensors (farm_id, sensor_type);
