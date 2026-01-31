/**
 * Service layer for triggering positive reinforcement messages
 * Centralized to prevent double-firing and ensure toasts only trigger on successful saves
 */
import { toast } from "sonner";
import { getReinforcementMessage, getWaterGoalCelebration, ReinforcementContext } from "./encouragementMessages";

// Debounce tracking to prevent double-firing on rapid logs
let lastMealToastTime = 0;
let lastWaterToastTime = 0;
const DEBOUNCE_MS = 1000; // Minimum 1 second between toasts of same type

const TOAST_DURATION = 2500; // Auto-dismiss after 2.5 seconds

/**
 * Trigger meal reinforcement toast - call after successful database save
 */
export const triggerMealReinforcement = (context?: ReinforcementContext): void => {
  const now = Date.now();
  if (now - lastMealToastTime < DEBOUNCE_MS) {
    return; // Skip if too soon after last toast
  }
  lastMealToastTime = now;
  
  const message = getReinforcementMessage('meal', context);
  toast.success(message, { duration: TOAST_DURATION });
};

/**
 * Trigger water reinforcement toast - call after successful database save
 * @param goalReached - Set to true if this log completes the daily water goal
 */
export const triggerWaterReinforcement = (goalReached: boolean = false): void => {
  const now = Date.now();
  if (now - lastWaterToastTime < DEBOUNCE_MS) {
    return; // Skip if too soon after last toast
  }
  lastWaterToastTime = now;
  
  const message = goalReached 
    ? getWaterGoalCelebration() 
    : getReinforcementMessage('water');
  toast.success(message, { duration: TOAST_DURATION });
};
