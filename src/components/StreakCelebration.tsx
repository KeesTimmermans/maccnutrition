import { useEffect, useState } from "react";
import { Flame, Trophy, X } from "lucide-react";
import { UserStreak } from "@/lib/streakService";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StreakCelebrationProps {
  streak: UserStreak | null;
  onClose: () => void;
}

export const StreakCelebration = ({ streak, onClose }: StreakCelebrationProps) => {
  const [open, setOpen] = useState(true);

  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  useEffect(() => {
    // Auto-close after 4 seconds
    const timer = setTimeout(() => {
      handleClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!streak) return null;

  const currentStreak = streak.current_streak;
  const isNewRecord = currentStreak > 0 && currentStreak === streak.longest_streak;
  const isMilestone = currentStreak === 7 || currentStreak === 14 || currentStreak === 30 || currentStreak === 100;

  const getMessage = () => {
    if (currentStreak === 1) return "Welcome back! 🎉";
    if (isMilestone) return `${currentStreak} days! Amazing milestone! 🏆`;
    if (isNewRecord && currentStreak > 1) return "New personal record! 🔥";
    if (currentStreak >= 7) return "You're on fire! Keep going! 🔥";
    return "Great consistency! 💪";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm text-center">
        <button 
          onClick={handleClose}
          className="absolute right-4 top-4 p-1 rounded-full hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
        
        <DialogHeader className="items-center pt-4">
          <div className="relative mb-4">
            <div className="w-20 h-20 bg-gradient-to-br from-secondary to-primary rounded-full flex items-center justify-center animate-pulse">
              <Flame className="w-10 h-10 text-white" />
            </div>
            {isNewRecord && currentStreak > 1 && (
              <div className="absolute -top-1 -right-1 bg-primary rounded-full p-1.5">
                <Trophy className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
          
          <DialogTitle className="text-3xl font-bold text-foreground">
            {currentStreak} Day{currentStreak !== 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 pb-4">
          <p className="text-lg font-semibold text-primary">
            {getMessage()}
          </p>
          <p className="text-sm text-muted-foreground">
            {currentStreak === 1 
              ? "Start building your streak today!"
              : `You've logged in ${currentStreak} days in a row!`
            }
          </p>
          
          {streak.longest_streak > currentStreak && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Trophy className="w-3 h-3 text-primary" />
              <span>Best streak: {streak.longest_streak} days</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
