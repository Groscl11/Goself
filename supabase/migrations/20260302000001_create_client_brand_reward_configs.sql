-- Client Brand Reward Configurations
-- Links a client to a marketplace/brand reward with a custom points cost
create table if not exists public.client_brand_reward_configs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  reward_id uuid not null references public.rewards(id) on delete cascade,
  points_cost integer not null default 500 check (points_cost > 0),
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, reward_id)
);

alter table public.client_brand_reward_configs enable row level security;

create policy "Clients manage their own brand reward configs"
  on public.client_brand_reward_configs
  for all
  using (
    client_id in (
      select client_id from public.profiles where id = auth.uid()
    )
  );

-- Manual rewards — stored in the rewards table with reward_type = 'manual'
-- No migration needed; we reuse the rewards table.
-- Ensure reward_type column allows 'manual' (it's text, so no enum to alter).
