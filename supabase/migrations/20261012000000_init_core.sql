-- Gelir Motoru SaaS — çekirdek şema (uygulandı: hotel-gelir-motoru, eu-central-1)
create extension if not exists pgcrypto;

create type member_role as enum ('owner','editor','viewer');
create type set_status as enum ('draft','locked');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table memberships (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role member_role not null default 'viewer',
  primary key (workspace_id, user_id)
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table assumption_sets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  version int not null,
  status set_status not null default 'draft',
  payload jsonb not null,
  engine_version text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

create table actuals (
  project_id uuid not null references projects(id) on delete cascade,
  month date not null,
  item text not null,
  amount numeric not null,
  primary key (project_id, month, item)
);

create table audit_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  at timestamptz not null default now()
);

-- yardımcı: kullanıcı çalışma alanı üyesi mi / rolü
create function is_member(ws uuid, min_role member_role default 'viewer') returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m where m.workspace_id = ws and m.user_id = auth.uid()
    and case min_role
      when 'viewer' then true
      when 'editor' then m.role in ('editor','owner')
      else m.role = 'owner' end);
$$;

alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table memberships enable row level security;
alter table projects enable row level security;
alter table assumption_sets enable row level security;
alter table actuals enable row level security;
alter table audit_log enable row level security;

create policy profiles_self on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy ws_read on workspaces for select using (is_member(id));
create policy ws_insert on workspaces for insert with check (created_by = auth.uid());
create policy ws_owner_write on workspaces for update using (is_member(id,'owner'));
create policy mem_read on memberships for select using (is_member(workspace_id));
create policy mem_owner_write on memberships for all using (is_member(workspace_id,'owner')) with check (is_member(workspace_id,'owner'));
create policy proj_read on projects for select using (is_member(workspace_id));
create policy proj_write on projects for all using (is_member(workspace_id,'editor')) with check (is_member(workspace_id,'editor'));
create policy sets_read on assumption_sets for select using (exists (select 1 from projects p where p.id = project_id and is_member(p.workspace_id)));
create policy sets_write on assumption_sets for insert with check (exists (select 1 from projects p where p.id = project_id and is_member(p.workspace_id,'editor')));
create policy sets_update_draft on assumption_sets for update using (status = 'draft' and exists (select 1 from projects p where p.id = project_id and is_member(p.workspace_id,'editor')));
create policy actuals_read on actuals for select using (exists (select 1 from projects p where p.id = project_id and is_member(p.workspace_id)));
create policy actuals_write on actuals for all using (exists (select 1 from projects p where p.id = project_id and is_member(p.workspace_id,'editor'))) with check (exists (select 1 from projects p where p.id = project_id and is_member(p.workspace_id,'editor')));

-- Sert limitler (DB tarafı): 3 proje, 3 üye, 10 sürüm, 24 ay gerçekleşen
create function enforce_limits() returns trigger language plpgsql as $$
begin
  if tg_table_name = 'projects' and (select count(*) from projects where workspace_id = new.workspace_id) >= 3 then
    raise exception 'limit: en fazla 3 proje';
  elsif tg_table_name = 'memberships' and (select count(*) from memberships where workspace_id = new.workspace_id) >= 3 then
    raise exception 'limit: en fazla 3 üye';
  elsif tg_table_name = 'assumption_sets' and (select count(*) from assumption_sets where project_id = new.project_id) >= 10 then
    raise exception 'limit: en fazla 10 varsayım sürümü';
  elsif tg_table_name = 'actuals' and (select count(distinct month) from actuals where project_id = new.project_id and month <> new.month) >= 24 then
    raise exception 'limit: en fazla 24 ay gerçekleşen';
  end if;
  return new;
end $$;

create trigger lim_projects before insert on projects for each row execute function enforce_limits();
create trigger lim_members before insert on memberships for each row execute function enforce_limits();
create trigger lim_sets before insert on assumption_sets for each row execute function enforce_limits();
create trigger lim_actuals before insert on actuals for each row execute function enforce_limits();

-- kilitli sürüm değişmez
create function block_locked_edit() returns trigger language plpgsql as $$
begin
  if old.status = 'locked' then raise exception 'kilitli sürüm değiştirilemez'; end if;
  return new;
end $$;
create trigger sets_locked before update on assumption_sets for each row execute function block_locked_edit();

-- çalışma alanını açan otomatik owner olur
create function add_owner_membership() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into memberships(workspace_id, user_id, role) values (new.id, new.created_by, 'owner');
  return new;
end $$;
create trigger ws_owner_auto after insert on workspaces for each row execute function add_owner_membership();

-- kayıtta profil oluştur
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, full_name) values (new.id, new.raw_user_meta_data->>'full_name') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

revoke execute on function add_owner_membership() from public, anon, authenticated;
revoke execute on function handle_new_user() from public, anon, authenticated;
revoke execute on function enforce_limits() from public, anon, authenticated;
revoke execute on function block_locked_edit() from public, anon, authenticated;
