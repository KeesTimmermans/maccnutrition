import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getUserBaseline, updateUserSettings } from "@/lib/userService";
import { useLanguage } from "@/lib/i18n";
import { STORE_KEYS, isStoreKey, type StoreKey } from "../../../supabase/functions/_shared/offCategories.ts";

const PREFERRED_STORE_KEY = ["scan-rate", "preferred-store"] as const;
const NO_STORE = "none";

/** The account's preferred store, with an optimistic setter that reverts on failure. */
export function usePreferredStore() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: PREFERRED_STORE_KEY,
    queryFn: async (): Promise<StoreKey | null> => {
      const baseline = await getUserBaseline();
      const value = baseline?.preferred_store;
      return isStoreKey(value) ? value : null;
    },
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: (store: StoreKey | null) => updateUserSettings({ preferred_store: store }),
    onMutate: async (store) => {
      await queryClient.cancelQueries({ queryKey: PREFERRED_STORE_KEY });
      const previous = queryClient.getQueryData<StoreKey | null>(PREFERRED_STORE_KEY) ?? null;
      queryClient.setQueryData(PREFERRED_STORE_KEY, store);
      return { previous };
    },
    onError: (_err, _store, context) => {
      queryClient.setQueryData(PREFERRED_STORE_KEY, context?.previous ?? null);
      toast.error(t("scan_rate_store_save_error"));
    },
  });

  return {
    store: query.data ?? null,
    loading: query.isPending,
    setStore: (store: StoreKey | null) => mutation.mutate(store),
  };
}

export function StorePicker({
  store,
  loading,
  onChange,
}: {
  store: StoreKey | null;
  loading: boolean;
  onChange: (store: StoreKey | null) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor="preferred-store" className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Store className="w-4 h-4 text-primary" />
        {t("scan_rate_your_store")}
      </label>
      <Select
        value={store ?? NO_STORE}
        onValueChange={(v) => onChange(isStoreKey(v) ? v : null)}
        disabled={loading}
      >
        <SelectTrigger id="preferred-store" className="w-44 h-9 rounded-xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[70]">
          <SelectItem value={NO_STORE}>{t("scan_rate_no_store")}</SelectItem>
          {STORE_KEYS.map((key) => (
            <SelectItem key={key} value={key}>
              {t(`store_${key}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
