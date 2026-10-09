import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/**
 * Blocages (repris de Buildr) : personnels et silencieux. Bloquer quelqu'un
 * masque ses messages et ses photos pour soi seul ; il n'en est pas prévenu.
 */
export interface BlockedUser {
  user_id: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

/** Ce qui change à l'écran quand on bloque ou débloque : les fils et les galeries. */
function useInvalidateBlocked() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["blocks"] });
    qc.invalidateQueries({ queryKey: ["menage-comments"] });
    qc.invalidateQueries({ queryKey: ["menage-photos"] });
  };
}

export function useBlocks(enabled = true) {
  return useQuery({
    queryKey: ["blocks"],
    queryFn: () => apiFetch<{ data: BlockedUser[] }>("/blocks"),
    enabled,
    select: (d) => d.data,
  });
}

export function useBlockUser() {
  const invalidate = useInvalidateBlocked();
  return useMutation({
    mutationFn: (userId: string) => apiFetch<{ user_id: string }>("/blocks", { method: "POST", body: { user_id: userId } }),
    onSuccess: invalidate,
  });
}

export function useUnblockUser() {
  const invalidate = useInvalidateBlocked();
  return useMutation({
    mutationFn: (userId: string) => apiFetch<void>(`/blocks/${userId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
