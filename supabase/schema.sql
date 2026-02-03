create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  original_servings integer not null,
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
