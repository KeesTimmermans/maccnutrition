import { useCallback, useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Dumbbell,
  Plus,
  X,
  Trash2,
  Pencil,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Camera,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  saveWorkout,
  updateWorkout,
  deleteWorkout,
  getWorkoutsForDate,
  getRecentWorkouts,
  getExerciseNameSuggestions,
  extractWorkoutFromPhoto,
  uploadWorkoutPhoto,
  type Workout as WorkoutRow,
  type WorkoutExercise,
  type WorkoutSet,
} from "@/lib/workoutService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that image"));
    reader.readAsDataURL(file);
  });


const WORKOUT_TYPES = [
  { key: "weightlifting", label: "Weightlifting", icon: "🏋️" },
  { key: "cardio", label: "Cardio/Running", icon: "🏃" },
  { key: "crossfit", label: "CrossFit", icon: "⚡" },
  { key: "yoga", label: "Yoga/Pilates", icon: "🧘" },
  { key: "hiit", label: "HIIT", icon: "🔥" },
  { key: "swimming", label: "Swimming", icon: "🏊" },
  { key: "cycling", label: "Cycling", icon: "🚴" },
  { key: "sports", label: "Team Sports", icon: "⚽" },
  { key: "martial_arts", label: "Martial Arts", icon: "🥋" },
  { key: "dance", label: "Dance", icon: "💃" },
  { key: "walking", label: "Walking Only", icon: "🚶" },
];

const typeMeta = (type: string) =>
  WORKOUT_TYPES.find((t) => t.key === type) ?? { key: type, label: type, icon: "💪" };

const todayStr = () => format(new Date(), "yyyy-MM-dd");

/* ---------------- Exercise editor ---------------- */

interface EditorProps {
  workout: WorkoutRow;
  defaultUnit: "kg" | "lb";
  onSaved: (w: WorkoutRow) => void;
  onCancel: () => void;
}

const ExerciseEditor = ({ workout, defaultUnit, onSaved, onCancel }: EditorProps) => {
  const [exercises, setExercises] = useState<WorkoutExercise[]>(
    workout.exercises?.length ? workout.exercises : []
  );
  const [duration, setDuration] = useState<string>(
    workout.duration_minutes != null ? String(workout.duration_minutes) : ""
  );
  const [notes, setNotes] = useState(workout.notes ?? "");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const results = await getExerciseNameSuggestions(query);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const addExercise = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setExercises((prev) => [
      ...prev,
      { name: clean, sets: [{ reps: 0, weight: 0, unit: defaultUnit }] },
    ]);
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const updateSet = (exIdx: number, setIdx: number, patch: Partial<WorkoutSet>) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== exIdx
          ? ex
          : { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, ...patch } : s)) }
      )
    );
  };

  const addSet = (exIdx: number) => {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [
            ...ex.sets,
            { reps: last?.reps ?? 0, weight: last?.weight ?? 0, unit: last?.unit ?? defaultUnit },
          ],
        };
      })
    );
  };

  const removeSet = (exIdx: number, setIdx: number) =>
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== exIdx ? ex : { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) }
      )
    );

  const removeExercise = (exIdx: number) =>
    setExercises((prev) => prev.filter((_, i) => i !== exIdx));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateWorkout(workout.id, {
        source: "manual",
        duration_minutes: duration ? parseInt(duration, 10) : null,
        notes: notes.trim() || null,
        exercises: exercises.filter((e) => e.name.trim()),
      });
      if (updated) {
        toast.success("Workout saved");
        onSaved(updated);
      }
    } catch {
      toast.error("Couldn't save workout. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Duration (min)</label>
          <Input
            type="number"
            min={0}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="45"
            className="h-9"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Notes</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How did it feel?"
          className="min-h-[60px] text-sm"
        />
      </div>

      {/* Exercise list */}
      <div className="space-y-3">
        {exercises.map((ex, exIdx) => (
          <div key={exIdx} className="border border-border rounded-xl p-3 bg-background">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm text-foreground">{ex.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => removeExercise(exIdx)}
                aria-label={`Remove ${ex.name}`}
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
            <div className="space-y-2">
              {ex.sets.map((set, setIdx) => (
                <div key={setIdx} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8">#{setIdx + 1}</span>
                  <Input
                    type="number"
                    min={0}
                    value={set.reps || ""}
                    onChange={(e) =>
                      updateSet(exIdx, setIdx, { reps: parseInt(e.target.value, 10) || 0 })
                    }
                    placeholder="reps"
                    className="h-8 w-16 text-center text-sm p-1"
                  />
                  <span className="text-xs text-muted-foreground">×</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    value={set.weight || ""}
                    onChange={(e) =>
                      updateSet(exIdx, setIdx, { weight: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="wt"
                    className="h-8 w-20 text-center text-sm p-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() =>
                      updateSet(exIdx, setIdx, { unit: set.unit === "kg" ? "lb" : "kg" })
                    }
                  >
                    {set.unit}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 ml-auto"
                    onClick={() => removeSet(exIdx, setIdx)}
                    aria-label="Remove set"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-8 text-xs text-primary"
              onClick={() => addSet(exIdx)}
            >
              <Plus className="w-3 h-3 mr-1" /> Add set
            </Button>
          </div>
        ))}
      </div>

      {/* Add exercise with autocomplete */}
      <div className="relative">
        <label className="text-xs text-muted-foreground">Add exercise</label>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addExercise(query);
              }
            }}
            placeholder="e.g. Back Squat"
            className="h-9"
          />
          <Button variant="outline" className="h-9" onClick={() => addExercise(query)}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-medium overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addExercise(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button className="flex-1" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save workout"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

/* ---------------- Page ---------------- */

const WorkoutPage = () => {
  const [loading, setLoading] = useState(true);
  const [defaultUnit, setDefaultUnit] = useState<"kg" | "lb">("kg");
  const [todayWorkouts, setTodayWorkouts] = useState<WorkoutRow[]>([]);
  const [recent, setRecent] = useState<WorkoutRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [justLogged, setJustLogged] = useState<WorkoutRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkoutRow | null>(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);


  const refresh = useCallback(async () => {
    const [today, all] = await Promise.all([
      getWorkoutsForDate(todayStr()),
      getRecentWorkouts(30),
    ]);
    setTodayWorkouts(today);
    setRecent(all);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("user_baselines")
          .select("unit_system")
          .eq("user_id", user.id)
          .maybeSingle();
        setDefaultUnit(data?.unit_system === "imperial" ? "lb" : "kg");
      }
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const handlePickType = async (type: string) => {
    setSavingType(type);
    try {
      const created = await saveWorkout({
        workout_date: todayStr(),
        workout_type: type,
        source: "checkbox_only",
        exercises: [],
      });
      if (created) {
        setPickerOpen(false);
        setJustLogged(created);
        await refresh();
      }
    } catch {
      toast.error("Couldn't log workout. Please try again.");
    } finally {
      setSavingType(null);
    }
  };

  const handlePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const target = justLogged;
    if (!file || !target) return;

    setPhotoProcessing(true);
    setPhotoNotice(null);

    try {
      const base64 = await fileToBase64(file);
      const [photoUrl, extraction] = await Promise.all([
        uploadWorkoutPhoto(file),
        extractWorkoutFromPhoto(base64),
      ]);

      await updateWorkout(target.id, {
        source: "photo",
        photo_url: photoUrl,
        exercises: extraction.exercises,
        duration_minutes: extraction.durationMinutes,
        ...(extraction.workoutType ? { workout_type: extraction.workoutType } : {}),
      });

      if (extraction.confidence === "low" || extraction.exercises.length === 0) {
        setPhotoNotice(
          extraction.notes ||
            "Couldn't clearly read the photo — check the exercises carefully."
        );
      }

      await refresh();
      setEditingId(target.id);
      setExpandedId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't read that photo");
      setEditingId(target.id);
      setExpandedId(null);
    } finally {
      setPhotoProcessing(false);
    }
  };


  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteWorkout(deleteTarget.id);
      toast.success("Workout deleted");
      setDeleteTarget(null);
      setEditingId(null);
      setJustLogged(null);
      await refresh();
    } catch {
      toast.error("Couldn't delete workout. Please try again.");
    }
  };

  const renderWorkoutRow = (w: WorkoutRow, showDate = true) => {
    const meta = typeMeta(w.workout_type);
    const isExpanded = expandedId === w.id;
    const exerciseCount = w.exercises?.length ?? 0;

    if (editingId === w.id) {
      return (
        <div key={w.id} className="border border-border rounded-2xl p-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{meta.icon}</span>
            <span className="font-medium text-sm">{meta.label}</span>
          </div>
          <ExerciseEditor
            workout={w}
            defaultUnit={defaultUnit}
            onSaved={async () => {
              setEditingId(null);
              setJustLogged(null);
              await refresh();
            }}
            onCancel={() => setEditingId(null)}
          />
        </div>
      );
    }

    return (
      <div key={w.id} className="border border-border rounded-2xl overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
          onClick={() => setExpandedId(isExpanded ? null : w.id)}
        >
          <span className="text-xl">{meta.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{meta.label}</p>
            <p className="text-xs text-muted-foreground">
              {showDate && format(parseISO(w.workout_date), "EEE d MMM")}
              {showDate && (w.duration_minutes || exerciseCount > 0) ? " · " : ""}
              {w.duration_minutes ? `${w.duration_minutes} min` : ""}
              {w.duration_minutes && exerciseCount > 0 ? " · " : ""}
              {exerciseCount > 0
                ? `${exerciseCount} exercise${exerciseCount === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {isExpanded && (
          <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
            {w.notes && <p className="text-xs text-muted-foreground">{w.notes}</p>}
            {exerciseCount > 0 ? (
              <div className="space-y-2">
                {w.exercises.map((ex, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium text-foreground">{ex.name}</p>
                    <div className="text-xs text-muted-foreground space-x-2">
                      {ex.sets.map((s, j) => (
                        <span key={j}>
                          {s.reps} × {s.weight}
                          {s.unit}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No exercise details logged.</p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setEditingId(w.id)}
              >
                <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(w)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const typePicker = (
    <div className="grid grid-cols-2 gap-2">
      {WORKOUT_TYPES.map((t) => (
        <button
          key={t.key}
          onClick={() => handlePickType(t.key)}
          disabled={savingType !== null}
          className="p-3 rounded-xl text-left transition-all flex items-center gap-2 bg-background border border-border hover:border-primary disabled:opacity-60"
        >
          <span className="text-lg">{t.icon}</span>
          <span className="text-sm font-medium">{t.label}</span>
          {savingType === t.key && <Loader2 className="w-3.5 h-3.5 animate-spin ml-auto" />}
        </button>
      ))}
    </div>
  );

  const history = recent.filter((w) => w.workout_date !== todayStr());

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        {/* Logging section */}
        <section className="bg-card rounded-3xl shadow-medium p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Dumbbell className="w-4.5 h-4.5 text-primary" />
            </div>
            <h1 className="text-lg font-semibold">Workout</h1>
          </div>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : justLogged && editingId !== justLogged.id ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <Check className="w-4 h-4" />
                {typeMeta(justLogged.workout_type).label} logged for today
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditingId(justLogged.id);
                    setExpandedId(null);
                  }}
                >
                  Add exercise details
                </Button>
                <Button className="flex-1" onClick={() => setJustLogged(null)}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <>
              {todayWorkouts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Today
                  </p>
                  {todayWorkouts.map((w) => renderWorkoutRow(w, false))}
                </div>
              )}

              {pickerOpen ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Pick a workout type</p>
                    <Button variant="ghost" size="sm" onClick={() => setPickerOpen(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {typePicker}
                </div>
              ) : (
                <Button className="w-full" onClick={() => setPickerOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  {todayWorkouts.length > 0 ? "Add another workout" : "Log a workout"}
                </Button>
              )}
            </>
          )}
        </section>

        {/* History */}
        <section className="bg-card rounded-3xl shadow-medium p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Recent workouts</h2>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Your logged workouts from the last 30 days will appear here.
            </p>
          ) : (
            <div className="space-y-2">{history.map((w) => renderWorkoutRow(w))}</div>
          )}
        </section>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this workout?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the workout and its exercise details.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default WorkoutPage;
