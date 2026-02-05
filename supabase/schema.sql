create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  original_servings integer not null,
  source_url text,
  payload jsonb not null,
  rating_value numeric,
  rating_count integer,
  allergens jsonb,
  tips jsonb,
  created_at timestamptz not null default now(),
  is_favorite boolean not null default false,
  tags text[] not null default '{}'::text[]
);

alter table recipes add column if not exists is_favorite boolean not null default false;
alter table recipes add column if not exists tags text[] not null default '{}'::text[];

create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  item text not null,
  amount numeric,
  unit text,
  position integer not null default 0
);

create table if not exists instructions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  step text not null,
  position integer not null default 0
);

create index if not exists ingredients_recipe_id_idx on ingredients(recipe_id);
create index if not exists instructions_recipe_id_idx on instructions(recipe_id);
create index if not exists recipes_user_id_idx on recipes(user_id);
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'recipes'
      and column_name = 'is_favorite'
  ) then
    create index if not exists recipes_favorite_idx on recipes(user_id, is_favorite);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_name = 'recipes'
      and column_name = 'tags'
  ) then
    create index if not exists recipes_tags_idx on recipes using gin(tags);
  end if;
end $$;

create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists collection_recipes (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collections(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (collection_id, recipe_id)
);

create index if not exists collection_recipes_collection_idx on collection_recipes(collection_id);
create index if not exists collection_recipes_recipe_idx on collection_recipes(recipe_id);

create table if not exists shared_recipes (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source_url text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  expires_at timestamptz
);

create index if not exists shared_recipes_recipe_idx on shared_recipes(recipe_id);
create index if not exists shared_recipes_user_idx on shared_recipes(user_id);

create table if not exists chat_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  recipe_id uuid references recipes(id) on delete set null,
  message_id text not null,
  vote text not null check (vote in ('up', 'down')),
  question text,
  answer text,
  preferences jsonb,
  created_at timestamptz not null default now()
);

create table if not exists discovery_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  device_id text,
  source text not null,
  external_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id),
  unique (device_id, source, external_id)
);

create index if not exists chat_feedback_user_idx on chat_feedback(user_id);
create index if not exists chat_feedback_recipe_idx on chat_feedback(recipe_id);
create index if not exists discovery_history_user_idx on discovery_history(user_id);
create index if not exists discovery_history_device_idx on discovery_history(device_id);

alter table recipes enable row level security;
alter table collections enable row level security;
alter table collection_recipes enable row level security;
alter table shared_recipes enable row level security;
alter table chat_feedback enable row level security;
alter table discovery_history enable row level security;

create policy "Users can read their recipes" on recipes
  for select using (auth.uid() = user_id);

create policy "Users can insert their recipes" on recipes
  for insert with check (auth.uid() = user_id);

create policy "Users can update their recipes" on recipes
  for update using (auth.uid() = user_id);

create policy "Users can delete their recipes" on recipes
  for delete using (auth.uid() = user_id);

create policy "Users can read their collections" on collections
  for select using (auth.uid() = user_id);

create policy "Users can insert their collections" on collections
  for insert with check (auth.uid() = user_id);

create policy "Users can update their collections" on collections
  for update using (auth.uid() = user_id);

create policy "Users can delete their collections" on collections
  for delete using (auth.uid() = user_id);

create policy "Users can read their collection recipes" on collection_recipes
  for select using (
    auth.uid() = (select user_id from collections where collections.id = collection_recipes.collection_id)
  );

create policy "Users can insert their collection recipes" on collection_recipes
  for insert with check (
    auth.uid() = (select user_id from collections where collections.id = collection_recipes.collection_id)
  );

create policy "Users can delete their collection recipes" on collection_recipes
  for delete using (
    auth.uid() = (select user_id from collections where collections.id = collection_recipes.collection_id)
  );

create policy "Public can read active shared recipes" on shared_recipes
  for select using (revoked_at is null and (expires_at is null or expires_at > now()));

create policy "Users can insert their shared recipes" on shared_recipes
  for insert with check (auth.uid() = user_id);

create policy "Users can update their shared recipes" on shared_recipes
  for update using (auth.uid() = user_id);

create policy "Users can delete their shared recipes" on shared_recipes
  for delete using (auth.uid() = user_id);

create policy "Users can insert chat feedback" on chat_feedback
  for insert with check (auth.uid() = user_id or auth.uid() is null);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'discovery_history'
      and policyname = 'Users can insert their discovery history'
  ) then
    create policy "Users can insert their discovery history" on discovery_history
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'discovery_history'
      and policyname = 'Users can read their discovery history'
  ) then
    create policy "Users can read their discovery history" on discovery_history
      for select using (auth.uid() = user_id);
  end if;
end $$;
