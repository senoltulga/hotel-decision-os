alter function enforce_limits() set search_path = public;
alter function block_locked_edit() set search_path = public;
revoke execute on function is_member(uuid, member_role) from public, anon;
grant execute on function is_member(uuid, member_role) to authenticated;
comment on table audit_log is 'Yalnızca service role yazar/okur; kasıtlı olarak politika yok.';
