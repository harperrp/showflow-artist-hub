-- Add missing columns to leads table for full CRM
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS event_date DATE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS venue_name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contractor_type TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Add missing columns to contracts table
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS fee NUMERIC;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Add latitude/longitude to calendar_events for map
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS venue_name TEXT;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS contractor_name TEXT;