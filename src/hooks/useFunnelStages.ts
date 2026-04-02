import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";

export interface FunnelStageRow {
  id: string;
  organization_id: string;
  name: string;
  position: number;
  color: string;
  created_at: string;
  updated_at: string;
}

export function useFunnelStages(orgId: string | null) {
  return useQuery({
    queryKey: ["funnel_stages", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await db
        .from("funnel_stages")
        .select("*")
        .eq("organization_id", orgId)
        .order("position", { ascending: true });
      if (error) throw error;
      return data as FunnelStageRow[];
    },
  });
}

export function useAddFunnelStage(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, position, color }: { name: string; position: number; color: string }) => {
      const { data, error } = await db
        .from("funnel_stages")
        .insert({ organization_id: orgId, name, position, color })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funnel_stages", orgId] }),
  });
}

export function useRenameFunnelStage(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, oldName, newName }: { id: string; oldName: string; newName: string }) => {
      // Update stage name
      const { error } = await db
        .from("funnel_stages")
        .update({ name: newName })
        .eq("id", id);
      if (error) throw error;

      // Update all leads that have the old stage name
      await db
        .from("leads")
        .update({ stage: newName })
        .eq("organization_id", orgId)
        .eq("stage", oldName);

      // Update calendar events too
      await db
        .from("calendar_events")
        .update({ stage: newName })
        .eq("organization_id", orgId)
        .eq("stage", oldName);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funnel_stages", orgId] });
      qc.invalidateQueries({ queryKey: ["leads", orgId] });
    },
  });
}

export function useReorderFunnelStages(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stages: { id: string; position: number }[]) => {
      for (const s of stages) {
        await db
          .from("funnel_stages")
          .update({ position: s.position })
          .eq("id", s.id);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["funnel_stages", orgId] }),
  });
}

export function useDeleteFunnelStage(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, moveToStage }: { id: string; name: string; moveToStage: string }) => {
      // Move leads from deleted stage to target stage
      await db
        .from("leads")
        .update({ stage: moveToStage })
        .eq("organization_id", orgId)
        .eq("stage", name);

      const { error } = await db
        .from("funnel_stages")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["funnel_stages", orgId] });
      qc.invalidateQueries({ queryKey: ["leads", orgId] });
    },
  });
}
