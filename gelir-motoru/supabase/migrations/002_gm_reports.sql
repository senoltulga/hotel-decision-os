-- Uygulandı: kullanıcı raporlarını (HTML) veritabanında saklar. RLS: yalnızca sahibi.
create table if not exists public.gm_reports(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_name text not null default 'Adsız',
  view_key text not null default '',
  title text not null default 'Rapor',
  html text not null,
  created_at timestamptz not null default now(),
  constraint gm_reports_size check (length(html) <= 2000000)
);
create index if not exists gm_reports_user_idx on public.gm_reports(user_id, created_at desc);
alter table public.gm_reports enable row level security;
create policy gm_reports_own on public.gm_reports for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
