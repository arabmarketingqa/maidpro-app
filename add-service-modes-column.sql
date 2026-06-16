-- Add service_modes column to staff table (safe to run multiple times)
-- Stores which booking modes each maid can handle: 'hourly', 'monthly', 'stayin'
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS service_modes text[] DEFAULT '{}';

-- Leave existing staff empty so admin assigns services manually
UPDATE public.staff SET service_modes = '{}' WHERE service_modes IS NULL;
