-- farms 테이블 생성 및 RLS (implementation-guide 2.1 / memo 524-527)
-- Supabase 대시보드 → SQL Editor에서 실행한다.

-- 1) 테이블
create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  location text,
  area_sqm numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.farms is '농장/구역 정보 (사용자별 소유)';

-- 2) updated_at 자동 갱신 (선택이지만 권장)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists farms_set_updated_at on public.farms;
create trigger farms_set_updated_at
  before update on public.farms
  for each row
  execute procedure public.set_updated_at();

-- 3) RLS
alter table public.farms enable row level security;

-- 기존 정책이 있으면 이름 충돌을 피하기 위해 제거 후 재생성
drop policy if exists "farms_select_own" on public.farms;
drop policy if exists "farms_insert_own" on public.farms;
drop policy if exists "farms_update_own" on public.farms;
drop policy if exists "farms_delete_own" on public.farms;

-- 본인 행만 조회
create policy "farms_select_own"
  on public.farms
  for select
  to authenticated
  using (user_id = auth.uid());

-- 본인 user_id로만 삽입
create policy "farms_insert_own"
  on public.farms
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- 본인 행만 수정
create policy "farms_update_own"
  on public.farms
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 본인 행만 삭제
create policy "farms_delete_own"
  on public.farms
  for delete
  to authenticated
  using (user_id = auth.uid());

-- 4) 인덱스 (목록 조회 시 user_id 필터에 유리)
create index if not exists farms_user_id_created_at_idx
  on public.farms (user_id, created_at desc);
