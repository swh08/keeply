create extension if not exists pgcrypto;
create schema if not exists auth;

set local search_path = auth, public;

create table auth."user" (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  "emailVerified" boolean not null default false,
  image text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table auth.session (
  id uuid primary key default gen_random_uuid(),
  "expiresAt" timestamptz not null,
  token text not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" uuid not null references auth."user"(id) on delete cascade
);

create index session_user_id_idx on auth.session("userId");

create table auth.account (
  id uuid primary key default gen_random_uuid(),
  "accountId" text not null,
  "providerId" text not null,
  "userId" uuid not null references auth."user"(id) on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null
);

create index account_user_id_idx on auth.account("userId");
create unique index account_provider_account_uidx on auth.account("providerId", "accountId");

create table auth.verification (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  value text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index verification_identifier_idx on auth.verification(identifier);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth."user"(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  locale text not null default 'system' check (locale in ('system', 'zh-CN', 'en')),
  default_currency text not null default 'USD' check (default_currency ~ '^[A-Z]{3}$'),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  density text not null default 'comfortable' check (density in ('comfortable', 'compact')),
  accent_theme text not null default 'moss' check (accent_theme in ('moss', 'indigo', 'graphite', 'sand')),
  privacy_blur_enabled boolean not null default false,
  app_lock_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth."user"(id) on delete cascade,
  parent_id uuid references public.categories(id) on delete set null,
  key text,
  name_zh text not null,
  name_en text not null,
  icon_key text not null default 'Package',
  color_key text not null default 'moss',
  sort_order integer not null default 0,
  is_system boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_system and user_id is null) or (not is_system and user_id is not null))
);

create unique index categories_system_key_uidx on public.categories(key) where is_system;
create index categories_user_parent_idx on public.categories(user_id, parent_id, sort_order);
create index categories_parent_idx on public.categories(parent_id);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth."user"(id) on delete cascade,
  parent_id uuid references public.locations(id) on delete set null,
  name text not null,
  icon_key text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index locations_user_parent_idx on public.locations(user_id, parent_id, sort_order);
create index locations_parent_idx on public.locations(parent_id);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth."user"(id) on delete cascade,
  name text not null,
  color_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth."user"(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text,
  category_id uuid references public.categories(id) on delete set null,
  subcategory_id uuid references public.categories(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  brand text,
  model text,
  serial_number text,
  cover_image_path text,
  icon_key text,
  color_key text,
  cost_mode text not null default 'ownership' check (cost_mode in ('ownership', 'per_use', 'recurring')),
  price_mode text not null default 'total' check (price_mode in ('total', 'per_unit')),
  purchase_amount numeric(20, 6) not null check (purchase_amount >= 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  purchase_date date not null,
  quantity numeric(20, 6) not null default 1 check (quantity > 0),
  quantity_unit text,
  usage_count integer not null default 0 check (usage_count >= 0),
  recurring_amount numeric(20, 6) check (recurring_amount >= 0),
  recurring_interval text check (recurring_interval in ('day', 'week', 'month', 'quarter', 'year')),
  recurring_interval_count integer check (recurring_interval_count > 0),
  recurring_start_date date,
  recurring_end_date date,
  auto_renew boolean,
  warranty_start_date date,
  warranty_end_date date,
  estimated_retirement_date date,
  actual_end_date date,
  status text not null default 'active' check (status in ('active', 'stored', 'lent', 'repairing', 'sold', 'gifted', 'lost', 'retired')),
  favorite boolean not null default false,
  merchant text,
  order_number text,
  purchase_url text,
  notes text,
  version integer not null default 1 check (version > 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (warranty_end_date is null or warranty_start_date is null or warranty_end_date >= warranty_start_date),
  check (recurring_end_date is null or recurring_start_date is null or recurring_end_date >= recurring_start_date),
  check (status not in ('sold', 'gifted', 'lost', 'retired') or actual_end_date is not null)
);

create index items_user_updated_idx on public.items(user_id, updated_at desc);
create index items_user_status_idx on public.items(user_id, status);
create index items_user_currency_idx on public.items(user_id, currency_code);
create index items_user_category_idx on public.items(user_id, category_id);
create index items_user_location_idx on public.items(user_id, location_id);
create index items_user_purchase_date_idx on public.items(user_id, purchase_date desc);
create index items_category_idx on public.items(category_id);
create index items_subcategory_idx on public.items(subcategory_id);
create index items_location_idx on public.items(location_id);
create index items_active_partial_idx on public.items(user_id, updated_at desc) where deleted_at is null;
create index items_search_idx on public.items using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(model, '') || ' ' || coalesce(notes, '')));

create table public.item_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth."user"(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  type text not null check (type in ('accessory', 'repair', 'maintenance', 'shipping', 'service', 'refund', 'resale', 'other')),
  title text not null check (length(btrim(title)) > 0),
  amount numeric(20, 6) not null check (amount >= 0),
  occurred_at date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index item_expenses_user_item_idx on public.item_expenses(user_id, item_id);
create index item_expenses_item_date_idx on public.item_expenses(item_id, occurred_at desc);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth."user"(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  count integer not null check (count > 0),
  occurred_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index usage_events_user_item_date_idx on public.usage_events(user_id, item_id, occurred_at desc);
create index usage_events_item_idx on public.usage_events(item_id);

create table public.item_tags (
  user_id uuid not null references auth."user"(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, tag_id)
);

create index item_tags_user_idx on public.item_tags(user_id);
create index item_tags_tag_idx on public.item_tags(tag_id, item_id);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth."user"(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  type text not null check (type in ('photo', 'receipt', 'warranty', 'manual', 'invoice', 'other')),
  file_name text not null,
  file_path text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0),
  checksum text,
  created_at timestamptz not null default now(),
  unique (user_id, file_path)
);

create index attachments_user_item_idx on public.attachments(user_id, item_id);
create index attachments_item_idx on public.attachments(item_id);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth."user"(id) on delete cascade,
  item_id uuid references public.items(id) on delete cascade,
  type text not null check (type in ('warranty', 'renewal', 'retirement', 'maintenance', 'return', 'custom')),
  title text not null check (length(btrim(title)) > 0),
  remind_at timestamptz not null,
  completed boolean not null default false,
  dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reminders_user_due_idx on public.reminders(user_id, completed, remind_at);
create index reminders_item_idx on public.reminders(item_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth."user"(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_user_created_idx on public.audit_logs(user_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);

create table public.sync_changes (
  sequence bigint generated always as identity primary key,
  operation_id uuid not null unique,
  user_id uuid not null references auth."user"(id) on delete cascade,
  entity_type text not null check (entity_type in ('item', 'expense', 'usage_event', 'reminder', 'category', 'location')),
  entity_id uuid not null,
  action text not null check (action in ('create', 'update', 'delete')),
  payload jsonb,
  created_at timestamptz not null default now(),
  check ((action = 'delete' and payload is null) or (action <> 'delete' and payload is not null))
);

create index sync_changes_user_sequence_idx on public.sync_changes(user_id, sequence);

create table public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth."user"(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  local_version jsonb not null,
  remote_version jsonb not null,
  resolution jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index sync_conflicts_user_open_idx on public.sync_conflicts(user_id, created_at desc) where resolved_at is null;

create table public.backup_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth."user"(id) on delete cascade unique,
  provider text not null default 'webdav' check (provider in ('webdav')),
  endpoint text not null,
  username text not null,
  encrypted_password bytea not null,
  remote_folder text not null default '/Keeply',
  frequency text not null default 'manual' check (frequency in ('manual', 'daily', 'weekly')),
  retention_count integer not null default 5 check (retention_count between 1 and 100),
  last_backup_at timestamptz,
  last_backup_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','categories','locations','tags','items','item_expenses','reminders','backup_configs'] loop
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.name)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth."user"
for each row execute function public.handle_new_user();

insert into public.categories (id, key, name_zh, name_en, icon_key, color_key, sort_order, is_system)
values
  ('00000000-0000-4000-8000-000000000001', 'digital', '数码电子', 'Electronics', 'Laptop', 'moss', 10, true),
  ('00000000-0000-4000-8000-000000000002', 'appliance', '家用电器', 'Appliances', 'Refrigerator', 'moss', 20, true),
  ('00000000-0000-4000-8000-000000000003', 'furniture', '家具家居', 'Furniture', 'Armchair', 'moss', 30, true),
  ('00000000-0000-4000-8000-000000000004', 'clothing', '服饰', 'Clothing', 'Shirt', 'moss', 40, true),
  ('00000000-0000-4000-8000-000000000005', 'accessories', '配饰', 'Accessories', 'Watch', 'moss', 50, true),
  ('00000000-0000-4000-8000-000000000006', 'beauty', '美妆护理', 'Beauty & Care', 'Sparkles', 'moss', 60, true),
  ('00000000-0000-4000-8000-000000000007', 'sports', '运动健身', 'Sports & Fitness', 'Dumbbell', 'moss', 70, true),
  ('00000000-0000-4000-8000-000000000008', 'transport', '交通出行', 'Transport', 'Car', 'moss', 80, true),
  ('00000000-0000-4000-8000-000000000009', 'tools', '工具设备', 'Tools', 'Wrench', 'moss', 90, true),
  ('00000000-0000-4000-8000-000000000010', 'books', '图书资料', 'Books', 'BookOpen', 'moss', 100, true),
  ('00000000-0000-4000-8000-000000000011', 'music', '乐器音频', 'Music', 'Music', 'moss', 110, true),
  ('00000000-0000-4000-8000-000000000012', 'gaming', '游戏娱乐', 'Gaming', 'Gamepad2', 'moss', 120, true),
  ('00000000-0000-4000-8000-000000000013', 'kitchen', '厨房用品', 'Kitchen', 'CookingPot', 'moss', 130, true),
  ('00000000-0000-4000-8000-000000000014', 'outdoor', '户外旅行', 'Outdoor & Travel', 'TentTree', 'moss', 140, true),
  ('00000000-0000-4000-8000-000000000015', 'pet', '宠物用品', 'Pet Supplies', 'PawPrint', 'moss', 150, true),
  ('00000000-0000-4000-8000-000000000016', 'collectibles', '收藏品', 'Collectibles', 'Gem', 'moss', 160, true),
  ('00000000-0000-4000-8000-000000000017', 'subscriptions', '订阅服务', 'Subscriptions', 'RefreshCw', 'moss', 170, true),
  ('00000000-0000-4000-8000-000000000018', 'office', '办公用品', 'Office', 'BriefcaseBusiness', 'moss', 180, true),
  ('00000000-0000-4000-8000-000000000019', 'other', '其他', 'Other', 'Package', 'moss', 190, true)
on conflict (key) where is_system do update
set name_zh = excluded.name_zh,
    name_en = excluded.name_en,
    icon_key = excluded.icon_key,
    sort_order = excluded.sort_order,
    updated_at = now();
