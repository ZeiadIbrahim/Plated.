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
  created_at timestamptz not null default now()
);

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

alter table recipes enable row level security;

create policy "Users can read their recipes" on recipes
  for select using (auth.uid() = user_id);

create policy "Users can insert their recipes" on recipes
  for insert with check (auth.uid() = user_id);

create policy "Users can update their recipes" on recipes
  for update using (auth.uid() = user_id);

create policy "Users can delete their recipes" on recipes
  for delete using (auth.uid() = user_id);
