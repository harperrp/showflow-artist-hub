export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  artist_name?: string;
  phone?: string;
  created_at: string;
}

export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  source?: string;
  funnel_stage_id?: string;
  notes?: string;
  value?: number;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface FunnelStage {
  id: string;
  name: string;
  order: number;
  color: string;
  user_id: string;
}

export interface Show {
  id: string;
  title: string;
  city: string;
  state?: string;
  venue?: string;
  date: string;
  time?: string;
  value: number;
  status: 'confirmado' | 'pendente' | 'cancelado' | 'realizado';
  notes?: string;
  lead_id?: string;
  user_id: string;
  created_at: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  status: 'aberto' | 'ganho' | 'perdido';
  lead_id?: string;
  show_id?: string;
  user_id: string;
  created_at: string;
  closed_at?: string;
}

export type MetricCard = {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'neutral';
};
