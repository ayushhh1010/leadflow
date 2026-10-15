import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { api } from "./api";
import type { Lead, LeadChanges, LeadDetail, LeadFilters, NewDiscussion } from "./types";

export const leadKeys = {
  lists: ["leads"] as const,
  list: (filters: LeadFilters) => ["leads", filters] as const,
  detail: (id: number) => ["lead", id] as const,
};

export function useLeads(filters: LeadFilters) {
  return useQuery({
    queryKey: leadKeys.list(filters),
    queryFn: ({ signal }) => api.listLeads(filters, signal),
    placeholderData: keepPreviousData,
  });
}

export function useLead(id: number) {
  return useQuery({
    queryKey: leadKeys.detail(id),
    queryFn: ({ signal }) => api.getLead(id, signal),
  });
}

/** Every write returns the updated lead: show it everywhere at once, then let the server re-sort. */
function storeLead(queryClient: QueryClient, lead: LeadDetail) {
  queryClient.setQueryData(leadKeys.detail(lead.id), lead);
  queryClient.setQueriesData<Lead[]>({ queryKey: leadKeys.lists }, (leads) =>
    leads?.map((item) => (item.id === lead.id ? lead : item)),
  );
  void queryClient.invalidateQueries({ queryKey: leadKeys.lists });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createLead,
    onSuccess: (lead) => storeLead(queryClient, lead),
  });
}

export function useUpdateLead(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: LeadChanges) => api.updateLead(id, changes),
    onSuccess: (lead) => storeLead(queryClient, lead),
  });
}

/** `onSaved` runs even if the form unmounted mid-request (callbacks passed to `mutate` would not). */
export function useAddDiscussion(id: number, onSaved?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewDiscussion) => api.addDiscussion(id, input),
    onSuccess: (lead) => {
      storeLead(queryClient, lead);
      onSaved?.();
    },
  });
}
