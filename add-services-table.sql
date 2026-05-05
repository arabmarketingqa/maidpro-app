-- Create services table
create table if not exists services (
  id          text primary key,
  name        text not null,
  icon        text not null default '🧹',
  base_rate   numeric not null default 15,
  mat_rate    numeric not null default 25,
  sort_order  int not null default 0,
  created_at  timestamptz default now()
);

-- Enable RLS (same open policy used by other tables)
alter table services enable row level security;
create policy "public_all" on services for all using (true) with check (true);

-- Seed default services
insert into services (id, name, icon, base_rate, mat_rate, sort_order) values
  ('svc1', 'Regular Cleaning',   '🧹', 15, 25, 1),
  ('svc2', 'Deep Cleaning',      '✨', 15, 25, 2),
  ('svc3', 'Move-in / Move-out', '📦', 15, 25, 3),
  ('svc4', 'Post-Construction',  '🏗️', 15, 25, 4)
on conflict (id) do nothing;
