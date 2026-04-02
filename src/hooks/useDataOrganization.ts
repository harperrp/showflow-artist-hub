import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// =============================================
// TAGS
// =============================================
export function useTags(orgId: string | null) {
  return useQuery({
    queryKey: ["tags", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await db
        .from("tags")
        .select("*")
        .eq("organization_id", orgId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateTag(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; color?: string }) => {
      const { data, error } = await db
        .from("tags")
        .insert({ ...payload, organization_id: orgId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags", orgId] });
      toast.success("Tag criada");
    },
    onError: (err: any) => {
      toast.error("Erro ao criar tag", { description: err.message });
    },
  });
}

export function useDeleteTag(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await db.from("tags").delete().eq("id", tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags", orgId] });
      toast.success("Tag removida");
    },
  });
}

// =============================================
// ENTITY TAGS
// =============================================
export function useEntityTags(entityType: string, entityId: string | null) {
  return useQuery({
    queryKey: ["entity_tags", entityType, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await db
        .from("entity_tags")
        .select("*, tag:tags(*)")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId);
      if (error) throw error;
      return data;
    },
  });
}

export function useAddEntityTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { tag_id: string; entity_type: string; entity_id: string }) => {
      const { error } = await db.from("entity_tags").insert(payload);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["entity_tags", vars.entity_type, vars.entity_id] });
    },
  });
}

export function useRemoveEntityTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { tag_id: string; entity_type: string; entity_id: string }) => {
      const { error } = await db
        .from("entity_tags")
        .delete()
        .eq("tag_id", payload.tag_id)
        .eq("entity_type", payload.entity_type)
        .eq("entity_id", payload.entity_id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["entity_tags", vars.entity_type, vars.entity_id] });
    },
  });
}

// =============================================
// CONTACTS
// =============================================
export function useContacts(orgId: string | null) {
  return useQuery({
    queryKey: ["contacts", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await db
        .from("contacts")
        .select("*")
        .eq("organization_id", orgId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertContact(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Unauthorized");

      const { data, error } = payload.id
        ? await db.from("contacts").update(payload).eq("id", payload.id).select().single()
        : await db
            .from("contacts")
            .insert({ ...payload, organization_id: orgId, created_by: user.id })
            .select()
            .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", orgId] });
    },
  });
}

export function useDeleteContact(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", orgId] });
      toast.success("Contato removido");
    },
  });
}

// =============================================
// VENUES
// =============================================
export function useVenues(orgId: string | null) {
  return useQuery({
    queryKey: ["venues", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await db
        .from("venues")
        .select("*, contact:contacts(name)")
        .eq("organization_id", orgId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertVenue(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Unauthorized");

      const { data, error } = payload.id
        ? await db.from("venues").update(payload).eq("id", payload.id).select().single()
        : await db
            .from("venues")
            .insert({ ...payload, organization_id: orgId, created_by: user.id })
            .select()
            .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["venues", orgId] });
    },
  });
}

// =============================================
// REGIONS
// =============================================
export function useRegions(orgId: string | null) {
  return useQuery({
    queryKey: ["regions", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await db
        .from("regions")
        .select("*, cities:region_cities(*)")
        .eq("organization_id", orgId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertRegion(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Unauthorized");

      const { data, error } = payload.id
        ? await db.from("regions").update(payload).eq("id", payload.id).select().single()
        : await db
            .from("regions")
            .insert({ ...payload, organization_id: orgId, created_by: user.id })
            .select()
            .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["regions", orgId] });
    },
  });
}

// =============================================
// NOTES
// =============================================
export function useNotes(entityType: string, entityId: string | null) {
  return useQuery({
    queryKey: ["notes", entityType, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await db
        .from("notes")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateNote(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { entity_type: string; entity_id: string; content: string }) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Unauthorized");

      const { data, error } = await db
        .from("notes")
        .insert({ ...payload, organization_id: orgId, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["notes", vars.entity_type, vars.entity_id] });
      toast.success("Nota adicionada");
    },
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; entity_type: string; entity_id: string }) => {
      const { error } = await db.from("notes").delete().eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["notes", vars.entity_type, vars.entity_id] });
      toast.success("Nota removida");
    },
  });
}

// =============================================
// ACTIVITY LOGS
// =============================================
export function useActivityLogs(entityType: string, entityId: string | null) {
  return useQuery({
    queryKey: ["activity_logs", entityType, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await db
        .from("activity_logs")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

export function useLogActivity(orgId: string | null) {
  return useMutation({
    mutationFn: async (payload: {
      entity_type: string;
      entity_id: string;
      action: string;
      old_value?: any;
      new_value?: any;
      metadata?: any;
    }) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Unauthorized");

      const { error } = await db.from("activity_logs").insert({
        ...payload,
        organization_id: orgId,
        user_id: user.id,
      });
      if (error) throw error;
    },
  });
}
