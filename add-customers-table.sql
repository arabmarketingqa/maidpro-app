-- Customers table (safe to run multiple times)
CREATE TABLE IF NOT EXISTS public.customers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  phone      TEXT,
  area       TEXT,
  address    TEXT,
  tag        TEXT NOT NULL DEFAULT 'new'
               CHECK (tag IN ('vip','loyal','new','regular','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_customers" ON public.customers;
CREATE POLICY "allow_all_customers" ON public.customers
  FOR ALL USING (true) WITH CHECK (true);
