import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n";
import { trackLabelRead } from "@/lib/analytics";
import {
  LABEL_NUMBER_FIELDS, countFilled, toPer100g, type LabelNumberField, type LabelReading, type LabelValues,
} from "@/lib/labelReading";

const FIELD_KEYS: Record<LabelNumberField, string> = {
  energyKcal: "label_field_energy", fatG: "label_field_fat", saturatedFatG: "label_field_sat_fat",
  carbsG: "label_field_carbs", sugarsG: "label_field_sugars", fibreG: "label_field_fibre",
  proteinG: "label_field_protein", saltG: "label_field_salt",
};
const ORDER: LabelNumberField[] = ["energyKcal", "fatG", "saturatedFatG", "carbsG", "sugarsG", "fibreG", "proteinG", "saltG"];

type Form = Record<LabelNumberField | "productName" | "ingredientsText", string>;
const toForm = (v: LabelValues): Form => {
  const f = { productName: v.productName ?? "", ingredientsText: v.ingredientsText ?? "" } as Form;
  for (const k of LABEL_NUMBER_FIELDS) f[k] = v[k] === null ? "" : String(v[k]);
  return f;
};
const fromForm = (f: Form): LabelValues => {
  const v = { productName: f.productName.trim() || null, ingredientsText: f.ingredientsText.trim() || null } as LabelValues;
  for (const k of LABEL_NUMBER_FIELDS) {
    const n = Number(f[k].replace(",", "."));
    v[k] = f[k].trim() === "" || !Number.isFinite(n) || n < 0 ? null : n;
  }
  return v;
};

const readFile = (file: File) => new Promise<string>((resolve, reject) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    resolve(c.toDataURL("image/jpeg", 0.85));
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
  img.src = url;
});

/** Button that opens the camera; the photo is only sent for reading, never stored. */
export function ReadLabelButton({ onRead }: { onRead: (values: LabelValues) => void }) {
  const { t } = useLanguage();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const imageBase64 = await readFile(file);
      const { data, error: fnError } = await supabase.functions.invoke("read-label", { body: { imageBase64 } });
      if (fnError) {
        const status = (fnError as { context?: Response }).context?.status;
        trackLabelRead({ readable: false, fieldsFilled: 0, outcome: status === 429 ? "limit" : "error" });
        setError(t(status === 429 ? "label_read_limit" : "label_read_error"));
        return;
      }
      if (!data?.readable) {
        trackLabelRead({ readable: false, fieldsFilled: 0, outcome: "unreadable" });
        setError(t("label_read_unreadable"));
        return;
      }
      const values = toPer100g(data as LabelReading);
      trackLabelRead({ readable: true, fieldsFilled: countFilled(values), outcome: "read" });
      onRead(values);
    } catch {
      trackLabelRead({ readable: false, fieldsFilled: 0, outcome: "error" });
      setError(t("label_read_error"));
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => handle(e.target.files?.[0])} />
      <Button variant="outline" className="w-full" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
        {t(busy ? "label_reading" : "label_read_button")}
      </Button>
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
    </div>
  );
}

export function LabelReviewForm({ initial, onScore, onCancel }: {
  initial: LabelValues; onScore: (v: LabelValues) => void; onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState<Form>(() => toForm(initial));
  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Card className="bg-card rounded-3xl shadow-medium p-5 space-y-4">
      <div>
        <p className="font-semibold text-foreground">{t("label_review_title")}</p>
        <p className="text-sm text-muted-foreground">{t("label_review_check")}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lbl-name">{t("label_field_name")}</Label>
        <Input id="lbl-name" value={form.productName} onChange={(e) => set("productName", e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">{t("label_per_100g")}</p>
      <div className="grid grid-cols-2 gap-3">
        {ORDER.map((k) => (
          <div key={k} className="space-y-1.5">
            <Label htmlFor={`lbl-${k}`}>{t(FIELD_KEYS[k])}</Label>
            <Input id={`lbl-${k}`} inputMode="decimal" value={form[k]} onChange={(e) => set(k, e.target.value)} />
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lbl-ingr">{t("label_field_ingredients")}</Label>
        <Textarea id="lbl-ingr" rows={4} value={form.ingredientsText} onChange={(e) => set("ingredientsText", e.target.value)} />
      </div>
      <Button className="w-full" onClick={() => onScore(fromForm(form))}>{t("label_score_it")}</Button>
      <Button variant="outline" className="w-full" onClick={onCancel}>{t("scan_rate_scan_another")}</Button>
    </Card>
  );
}
