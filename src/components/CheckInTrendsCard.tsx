import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRecentCheckIns, DailyCheckIn } from "@/lib/checkinService";

interface TrendPoint {
  date: string;
  mood: number | null;
  energy: number | null;
  sleepQuality: number | null;
  stress: number | null;
  sleepHours: number | null;
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

export const CheckInTrendsCard = () => {
  const [data, setData] = useState<TrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const checkIns = await getRecentCheckIns(7);
        setData(mapCheckIns(checkIns));
      } catch (error) {
        console.error("Error loading check-in trends:", error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const mapCheckIns = (checkIns: DailyCheckIn[]): TrendPoint[] => {
    const today = new Date();
    const days = eachDayOfInterval({
      start: startOfWeek(today, { weekStartsOn: 1 }),
      end: endOfWeek(today, { weekStartsOn: 1 }),
    });

    return days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const c = checkIns.find((ci) => ci.check_in_date === dateStr);
      return {
        date: format(day, "EEE"),
        mood: c?.mood ?? null,
        energy: c?.energy_level ?? null,
        sleepQuality: c?.sleep_quality ?? null,
        stress: c?.stress_level ?? null,
        sleepHours: c?.sleep_hours ?? null,
      };
    });
  };

  const hasSleepHours = data.some((d) => d.sleepHours !== null);
  const hasAnyCheckIn = data.some(
    (d) => d.mood !== null || d.energy !== null || d.sleepQuality !== null || d.stress !== null || d.sleepHours !== null
  );

  return (
    <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold text-foreground">Check-In Trends</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading trends...</p>
        ) : !hasAnyCheckIn ? (
          <div className="py-8 text-center">
            <p className="text-2xl mb-2">📈</p>
            <p className="text-sm text-muted-foreground">Check in today to start this week's trend.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">How you've felt (1-5)</p>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="mood" name="Mood" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    <Line type="monotone" dataKey="energy" name="Energy" stroke="hsl(var(--carbs))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    <Line type="monotone" dataKey="sleepQuality" name="Sleep quality" stroke="hsl(var(--protein))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    <Line type="monotone" dataKey="stress" name="Stress" stroke="hsl(var(--fats))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-2">
                {[
                  { label: "Mood", color: "hsl(var(--primary))" },
                  { label: "Energy", color: "hsl(var(--carbs))" },
                  { label: "Sleep quality", color: "hsl(var(--protein))" },
                  { label: "Stress", color: "hsl(var(--fats))" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {hasSleepHours && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Sleep (hours)</p>
                <div className="h-[120px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="sleepHours" name="Sleep hours" stroke="hsl(var(--calories))" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
