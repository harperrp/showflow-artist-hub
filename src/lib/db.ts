import { supabase } from "@/integrations/supabase/client";

// The generated Database types may lag behind migrations; for now we use an untyped facade.
// When types update, we can remove these casts.
export const db = supabase as any;
