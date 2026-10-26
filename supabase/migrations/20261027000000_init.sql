-- Paperflow schema: profiles, documents, document_shares + Row Level Security.
-- Run once in the Supabase SQL editor (or `supabase db push`). Idempotency is not attempted;
-- run against a fresh project.

-- ---------------------------------------------------------------------------
-- Profiles: a minimal public mirror of auth.users (id + email) so that sharing
-- can resolve an email to a user and owners/recipients can see each other's email.
-- Visibility is restricted by RLS to yourself and people you share documents with.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique check (email = lower(email)),
  created_at timestamptz not null default now()
);

create or replace function public.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;
  end if;
  insert into public.profiles (id, email)
  values (new.id, lower(new.email))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_change
  after insert or update of email on auth.users
  for each row execute function public.handle_auth_user_change();

-- Backfill users that existed before this migration.
insert into public.profiles (id, email)
select id, lower(email) from auth.users where email is not null
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null default 'Untitled document'
    check (char_length(btrim(title)) between 1 and 200),
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb
    check (
      jsonb_typeof(content) = 'object'
      and content ->> 'type' = 'doc'
      and octet_length(content::text) <= 1000000
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_owner_updated_idx on public.documents (owner_id, updated_at desc);
create index documents_updated_idx on public.documents (updated_at desc);

-- ---------------------------------------------------------------------------
-- Sharing
-- ---------------------------------------------------------------------------
create type public.share_permission as enum ('viewer', 'editor');

create table public.document_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  shared_with_user_id uuid not null references public.profiles (id) on delete cascade,
  permission public.share_permission not null default 'viewer',
  created_at timestamptz not null default now(),
  constraint document_shares_document_user_key unique (document_id, shared_with_user_id)
);

create index document_shares_user_idx on public.document_shares (shared_with_user_id);

-- Owners can never be "shared with" on their own document.
create or replace function public.prevent_self_share()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.documents d
    where d.id = new.document_id and d.owner_id = new.shared_with_user_id
  ) then
    raise exception 'cannot share a document with its owner';
  end if;
  return new;
end;
$$;

create trigger document_shares_prevent_self_share
  before insert or update on public.document_shares
  for each row execute function public.prevent_self_share();

-- Server-maintained timestamps; owner/created_at are immutable after insert.
create or replace function public.documents_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id or new.created_at is distinct from old.created_at then
    raise exception 'owner_id and created_at are immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger documents_before_update
  before update on public.documents
  for each row execute function public.documents_before_update();

-- ---------------------------------------------------------------------------
-- RLS helper functions. SECURITY DEFINER lets policies on one table consult the
-- other without recursive policy evaluation. Each only answers about auth.uid().
-- ---------------------------------------------------------------------------
create or replace function public.is_document_owner(doc_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.documents d
    where d.id = doc_id and d.owner_id = (select auth.uid())
  );
$$;

create or replace function public.document_share_permission(doc_id uuid)
returns public.share_permission
language sql
stable
security definer
set search_path = ''
as $$
  select s.permission from public.document_shares s
  where s.document_id = doc_id and s.shared_with_user_id = (select auth.uid());
$$;

create or replace function public.can_view_profile(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select profile_id = (select auth.uid())
    or exists (
      select 1
      from public.document_shares s
      join public.documents d on d.id = s.document_id
      where (d.owner_id = profile_id and s.shared_with_user_id = (select auth.uid()))
         or (d.owner_id = (select auth.uid()) and s.shared_with_user_id = profile_id)
    );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_shares enable row level security;

create policy "profiles: self and sharing counterparts can read"
  on public.profiles for select to authenticated
  using (public.can_view_profile(id));

create policy "documents: owner or share recipient can read"
  on public.documents for select to authenticated
  using (owner_id = (select auth.uid()) or public.document_share_permission(id) is not null);

create policy "documents: users create their own"
  on public.documents for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "documents: owner or editor can update"
  on public.documents for update to authenticated
  using (owner_id = (select auth.uid()) or public.document_share_permission(id) = 'editor')
  with check (owner_id = (select auth.uid()) or public.document_share_permission(id) = 'editor');

create policy "documents: owner can delete"
  on public.documents for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "shares: recipient or document owner can read"
  on public.document_shares for select to authenticated
  using (shared_with_user_id = (select auth.uid()) or public.is_document_owner(document_id));

create policy "shares: document owner can update permission"
  on public.document_shares for update to authenticated
  using (public.is_document_owner(document_id))
  with check (public.is_document_owner(document_id));

create policy "shares: document owner can revoke"
  on public.document_shares for delete to authenticated
  using (public.is_document_owner(document_id));
-- No INSERT policy on document_shares: new shares are created only through
-- share_document() below, which resolves the recipient's email server-side.

-- ---------------------------------------------------------------------------
-- Privileges: nothing for anonymous users; column-level limits for signed-in users.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.documents, public.document_shares from anon, authenticated;

grant select on public.profiles to authenticated;
grant select, delete on public.documents to authenticated;
grant insert (title, content) on public.documents to authenticated;
grant update (title, content) on public.documents to authenticated;
grant select, delete on public.document_shares to authenticated;
grant update (permission) on public.document_shares to authenticated;

revoke execute on function
  public.handle_auth_user_change(),
  public.prevent_self_share(),
  public.documents_before_update()
  from public, anon, authenticated;
revoke execute on function
  public.is_document_owner(uuid),
  public.document_share_permission(uuid),
  public.can_view_profile(uuid)
  from public, anon;
grant execute on function
  public.is_document_owner(uuid),
  public.document_share_permission(uuid),
  public.can_view_profile(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- share_document: owner grants (or changes) access for an existing user by email.
-- Returns a status code instead of raising so the app can show precise messages.
-- ---------------------------------------------------------------------------
create or replace function public.share_document(
  p_document_id uuid,
  p_email text,
  p_permission public.share_permission default 'viewer'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_target uuid;
  v_existing public.share_permission;
begin
  if v_uid is null then
    return 'not_authenticated';
  end if;

  select d.owner_id into v_owner from public.documents d where d.id = p_document_id;
  -- Same response for "missing" and "not yours" so IDs cannot be probed.
  if v_owner is null or v_owner <> v_uid then
    return 'not_found';
  end if;

  select p.id into v_target from public.profiles p where p.email = lower(btrim(p_email));
  if v_target is null then
    return 'user_not_found';
  end if;
  if v_target = v_uid then
    return 'cannot_share_with_self';
  end if;

  select s.permission into v_existing
  from public.document_shares s
  where s.document_id = p_document_id and s.shared_with_user_id = v_target;

  if v_existing is null then
    insert into public.document_shares (document_id, shared_with_user_id, permission)
    values (p_document_id, v_target, p_permission);
    return 'created';
  elsif v_existing = p_permission then
    return 'unchanged';
  else
    update public.document_shares
    set permission = p_permission
    where document_id = p_document_id and shared_with_user_id = v_target;
    return 'updated';
  end if;
end;
$$;

revoke execute on function public.share_document(uuid, text, public.share_permission) from public, anon;
grant execute on function public.share_document(uuid, text, public.share_permission) to authenticated;
