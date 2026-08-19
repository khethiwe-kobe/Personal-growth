-- Hearth — shared household budget
-- Run this whole file once in the Supabase SQL editor (SQL Editor -> New query -> paste -> Run).
-- It is idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- Profiles (one row per auth user, created automatically on signup)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  display_name text not null default '',
  avatar_path text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Households and membership
-- ---------------------------------------------------------------------------
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  rent_total numeric(12,2) not null default 8800,
  rent_per_person numeric(12,2) not null default 4400,
  monthly_budget numeric(12,2),
  grocery_budget numeric(12,2),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Membership check used by every policy. SECURITY DEFINER so policies on
-- household_members itself do not recurse.
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Categories (per household, seeded on creation)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  kind text not null default 'expense' check (kind in ('expense', 'income')),
  sort int not null default 0,
  unique (household_id, name)
);

-- ---------------------------------------------------------------------------
-- Transactions — the single source of truth for every rand that moves.
-- Rent, groceries, electricity, transport, business and settlements are all
-- rows here (distinguished by `kind`), so every balance is traceable.
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  occurred_on date not null default current_date,
  description text not null,
  category_id uuid references public.categories (id) on delete set null,
  amount numeric(12,2) not null check (amount >= 0),
  type text not null check (type in ('expense', 'income')),
  scope text not null default 'shared' check (scope in ('shared', 'personal', 'business')),
  kind text not null default 'general' check (kind in (
    'general', 'rent', 'grocery', 'electricity', 'transport',
    'business_income', 'business_expense', 'contribution', 'settlement'
  )),
  paid_by uuid references public.profiles (id),
  split_type text not null default 'none' check (split_type in ('none', 'equal', 'custom')),
  receipt_path text,
  notes text,
  -- kind-specific fields: rent month, store, kwh, transport type, client, service, payment status…
  meta jsonb not null default '{}'::jsonb,
  review_status text not null default 'approved' check (review_status in ('approved', 'needs_review')),
  source text not null default 'manual' check (source in ('manual', 'import')),
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_household_date on public.transactions (household_id, occurred_on desc);

create or replace function public.touch_transaction()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists transactions_touch on public.transactions;
create trigger transactions_touch
  before update on public.transactions
  for each row execute function public.touch_transaction();

-- Who owes what on a shared transaction: one row per member with their share.
create table if not exists public.transaction_splits (
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  share_amount numeric(12,2) not null default 0,
  primary key (transaction_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Groceries and meals
-- ---------------------------------------------------------------------------
create table if not exists public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  quantity text not null default '1',
  category text not null default 'Other',
  est_price numeric(12,2),
  actual_price numeric(12,2),
  purchased boolean not null default false,
  purchased_by uuid references public.profiles (id),
  transaction_id uuid references public.transactions (id) on delete set null,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  category text not null default 'Dinner',
  ingredients jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  week_start date not null,
  day int not null check (day between 0 and 6),
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner')),
  meal_id uuid not null references public.meals (id) on delete cascade,
  unique (household_id, week_start, day, slot)
);

-- ---------------------------------------------------------------------------
-- Joint account: uploaded statements + imported rows awaiting review
-- ---------------------------------------------------------------------------
create table if not exists public.statements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  file_name text not null,
  file_path text,
  status text not null default 'uploaded' check (status in ('uploaded', 'processed')),
  uploaded_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.imported_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  statement_id uuid references public.statements (id) on delete cascade,
  occurred_on date not null,
  description text not null,
  amount numeric(12,2) not null,
  type text not null check (type in ('expense', 'income')),
  suggested_category text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Activity / audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid references public.profiles (id),
  action text not null,
  entity text not null,
  entity_id text,
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_household_time on public.activity_log (household_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RPCs for household creation / joining (avoid RLS chicken-and-egg)
-- ---------------------------------------------------------------------------
create or replace function public.create_household(p_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  hid uuid;
  code text;
begin
  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.households (name, invite_code, created_by)
  values (p_name, code, auth.uid())
  returning id into hid;

  insert into public.household_members (household_id, user_id, role)
  values (hid, auth.uid(), 'owner');

  insert into public.categories (household_id, name, kind, sort) values
    (hid, 'Rent', 'expense', 1),
    (hid, 'Groceries', 'expense', 2),
    (hid, 'Electricity', 'expense', 3),
    (hid, 'Transport', 'expense', 4),
    (hid, 'Household', 'expense', 5),
    (hid, 'Eating out', 'expense', 6),
    (hid, 'Other', 'expense', 7),
    (hid, 'Business income', 'income', 8),
    (hid, 'Other income', 'income', 9);

  insert into public.activity_log (household_id, user_id, action, entity, summary)
  values (hid, auth.uid(), 'create', 'household', 'created the household');

  return hid;
end;
$$;

create or replace function public.join_household(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  hid uuid;
begin
  select id into hid from public.households where invite_code = upper(trim(p_code));
  if hid is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.household_members (household_id, user_id)
  values (hid, auth.uid())
  on conflict do nothing;

  insert into public.activity_log (household_id, user_id, action, entity, summary)
  values (hid, auth.uid(), 'join', 'household', 'joined the household');

  return hid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_splits enable row level security;
alter table public.grocery_items enable row level security;
alter table public.meals enable row level security;
alter table public.meal_plan enable row level security;
alter table public.statements enable row level security;
alter table public.imported_transactions enable row level security;
alter table public.activity_log enable row level security;

-- profiles: yourself + people you share a household with
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  id = auth.uid() or exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  )
);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- households
drop policy if exists households_select on public.households;
create policy households_select on public.households for select
  using (public.is_household_member(id));
drop policy if exists households_update on public.households;
create policy households_update on public.households for update
  using (public.is_household_member(id)) with check (public.is_household_member(id));

-- household_members
drop policy if exists members_select on public.household_members;
create policy members_select on public.household_members for select
  using (public.is_household_member(household_id));

-- generic member policies for household-scoped tables
drop policy if exists categories_all on public.categories;
create policy categories_all on public.categories for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists transactions_all on public.transactions;
create policy transactions_all on public.transactions for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists splits_all on public.transaction_splits;
create policy splits_all on public.transaction_splits for all
  using (exists (
    select 1 from public.transactions t
    where t.id = transaction_id and public.is_household_member(t.household_id)
  ))
  with check (exists (
    select 1 from public.transactions t
    where t.id = transaction_id and public.is_household_member(t.household_id)
  ));

drop policy if exists grocery_items_all on public.grocery_items;
create policy grocery_items_all on public.grocery_items for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists meals_all on public.meals;
create policy meals_all on public.meals for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists meal_plan_all on public.meal_plan;
create policy meal_plan_all on public.meal_plan for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists statements_all on public.statements;
create policy statements_all on public.statements for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists imports_all on public.imported_transactions;
create policy imports_all on public.imported_transactions for all
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists activity_select on public.activity_log;
create policy activity_select on public.activity_log for select
  using (public.is_household_member(household_id));
drop policy if exists activity_insert on public.activity_log;
create policy activity_insert on public.activity_log for insert
  with check (public.is_household_member(household_id) and user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: private bucket for receipts / screenshots / statements / avatars.
-- Files are stored under <household_id>/... so membership gates access.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists receipts_select on storage.objects;
create policy receipts_select on storage.objects for select
  using (bucket_id = 'receipts' and public.is_household_member(((storage.foldername(name))[1])::uuid));
drop policy if exists receipts_insert on storage.objects;
create policy receipts_insert on storage.objects for insert
  with check (bucket_id = 'receipts' and public.is_household_member(((storage.foldername(name))[1])::uuid));
drop policy if exists receipts_update on storage.objects;
create policy receipts_update on storage.objects for update
  using (bucket_id = 'receipts' and public.is_household_member(((storage.foldername(name))[1])::uuid));
drop policy if exists receipts_delete on storage.objects;
create policy receipts_delete on storage.objects for delete
  using (bucket_id = 'receipts' and public.is_household_member(((storage.foldername(name))[1])::uuid));
