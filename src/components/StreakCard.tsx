import { Flame, MessageSquare, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { UserStreak } from "@/lib/streakService";

interface StreakCardProps {
  loginStreak: UserStreak | null;
  coachingStreak: UserStreak | null;
}

export const StreakCard = ({ loginStreak, coachingStreak }: StreakCardProps) => {
  const loginCurrent = loginStreak?.current_streak || 0;
  const loginBest = loginStreak?.longest_streak || 0;
  const coachingCurrent = coachingStreak?.current_streak || 0;
  const coachingBest = coachingStreak?.longest_streak || 0;

  return (
    <Card className="bg-card rounded-3xl shadow-medium overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-foreground">Consistency Streaks</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Login Streak */}
          <div className="bg-muted/50 rounded-2xl p-4 text-center">
            <div className="flex justify-center mb-2">
              <div className="p-2 bg-secondary/20 rounded-full">
                <Flame className="w-6 h-6 text-secondary" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground">{loginCurrent}</p>
            <p className="text-xs text-muted-foreground font-medium">Day Login Streak</p>
            <div className="mt-2 flex items-center justify-center gap-1">
              <Trophy className="w-3 h-3 text-primary" />
              <span className="text-xs text-primary font-semibold">Best: {loginBest}</span>
            </div>
          </div>

          {/* Coaching Streak */}
          <div className="bg-muted/50 rounded-2xl p-4 text-center">
            <div className="flex justify-center mb-2">
              <div className="p-2 bg-primary/20 rounded-full">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground">{coachingCurrent}</p>
            <p className="text-xs text-muted-foreground font-medium">Day Coaching Streak</p>
            <div className="mt-2 flex items-center justify-center gap-1">
              <Trophy className="w-3 h-3 text-primary" />
              <span className="text-xs text-primary font-semibold">Best: {coachingBest}</span>
            </div>
          </div>
        </div>

        {(loginCurrent >= 7 || coachingCurrent >= 7) && (
          <div className="mt-4 p-3 bg-primary/10 rounded-xl text-center">
            <p className="text-sm font-semibold text-primary">
              🎉 Amazing consistency! Keep it up!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
