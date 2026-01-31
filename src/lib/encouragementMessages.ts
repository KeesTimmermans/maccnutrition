/**
 * Positive reinforcement messages for meal and water logging
 * Returns varied, encouraging messages to celebrate tracking
 */

// Track last shown message to avoid repeats
let lastMealMessageIndex = -1;
let lastWaterMessageIndex = -1;

const mealMessages = [
  "Nice one! Every meal tracked is a step forward 💪",
  "Logged! You're building awesome habits 🌟",
  "Another meal tracked — that's dedication! 🔥",
  "Great choice! Keeping yourself accountable 📊",
  "Tracked! You're crushing it today 💯",
  "Meal logged! Consistency is your superpower ⚡",
  "You're on fire! Keep that momentum going 🚀",
  "Another win for your nutrition journey! 🎯",
  "Logged and loaded! Your body thanks you 🙌",
  "Boom! One more meal in the books 📝",
  "Way to stay on top of your goals! 🏆",
  "That's the spirit! Every log counts ✨",
  "Meal tracked! You're doing amazing 💪",
  "Keep it up! You're making progress every day 🌱",
  "Nailed it! Your future self will thank you 🎉",
  "Look at you go! Staying consistent 🌟",
  "Logged! Small steps, big results 🚶‍♂️",
  "You showed up for yourself today! 💚",
  "Another one down! You're unstoppable 🔥",
  "Tracked with ease! Proud of you 🙌",
];

const mealTypeMessages: Record<string, string[]> = {
  breakfast: [
    "Great start to the day! Breakfast logged 🌅",
    "Morning fuel tracked! You're set up for success ☀️",
    "Breakfast in the books! Nicely done 🍳",
  ],
  lunch: [
    "Midday meal logged! Keeping the momentum 🌞",
    "Lunch tracked! You're crushing it today 🥗",
    "Afternoon fuel noted! Stay energized 💪",
  ],
  dinner: [
    "Dinner logged! Ending the day strong 🌙",
    "Evening meal tracked! Great consistency 🍽️",
    "Dinner in the books! Well done today ✨",
  ],
};

const waterMessages = [
  "Hydration station! Great job 💧",
  "Staying hydrated like a champ! 🏆",
  "Every sip counts — well done! 💦",
  "H2O hero! Keep it flowing 🌊",
  "Hydrated and motivated! 💪",
  "Nice! Your body loves that water 🙌",
  "Sip sip hooray! 🎉",
  "Hydration game strong! 💧",
  "Water logged! You're crushing it 🌟",
  "Quench that thirst! Great work 💦",
  "Staying topped up — love to see it! ⚡",
  "Another glass down! Keep going 🚰",
  "Hydration on point! 🎯",
  "Your cells are celebrating! 🧬",
  "Refreshed and tracked! Nice one 💧",
  "Liquid gold logged! Keep flowing 🌊",
  "Water warrior! You're doing great 💪",
  "Hydration habit on lock! 🔒",
  "Sipping your way to success! 🥤",
  "That's the hydration spirit! 💦",
];

const waterGoalReachedMessages = [
  "🎉 HYDRATION GOAL SMASHED! You're a water warrior!",
  "🏆 Daily water goal hit! Your body is thriving!",
  "💧 Water goal complete! That's elite hydration!",
  "🌊 Goal reached! You're officially well-hydrated!",
  "⚡ Hydration goal crushed! Feel that energy!",
];

/**
 * Get a random index avoiding the last shown
 */
const getRandomIndex = (arrayLength: number, lastIndex: number): number => {
  if (arrayLength <= 1) return 0;
  let newIndex: number;
  do {
    newIndex = Math.floor(Math.random() * arrayLength);
  } while (newIndex === lastIndex);
  return newIndex;
};

/**
 * Get a random positive message for meal logging
 */
export const getMealEncouragement = (): string => {
  const index = getRandomIndex(mealMessages.length, lastMealMessageIndex);
  lastMealMessageIndex = index;
  return mealMessages[index];
};

/**
 * Get a random positive message for water logging
 */
export const getWaterEncouragement = (): string => {
  const index = getRandomIndex(waterMessages.length, lastWaterMessageIndex);
  lastWaterMessageIndex = index;
  return waterMessages[index];
};

/**
 * Get a random celebration message for reaching water goal
 */
export const getWaterGoalCelebration = (): string => {
  const index = Math.floor(Math.random() * waterGoalReachedMessages.length);
  return waterGoalReachedMessages[index];
};

export interface ReinforcementContext {
  mealType?: 'breakfast' | 'lunch' | 'dinner';
}

/**
 * Unified helper function for reinforcement messages
 * @param type - 'meal' or 'water'
 * @param context - optional context like meal type
 */
export const getReinforcementMessage = (
  type: 'meal' | 'water',
  context?: ReinforcementContext
): string => {
  if (type === 'water') {
    return getWaterEncouragement();
  }

  // For meals, optionally use meal type specific messages
  if (context?.mealType && mealTypeMessages[context.mealType]) {
    const typeMessages = mealTypeMessages[context.mealType];
    // 30% chance to use meal-type specific message
    if (Math.random() < 0.3) {
      return typeMessages[Math.floor(Math.random() * typeMessages.length)];
    }
  }

  return getMealEncouragement();
};

/**
 * Get an encouraging message based on progress percentage
 */
export const getProgressEncouragement = (
  type: 'calories' | 'protein' | 'carbs' | 'fats' | 'water',
  percentage: number
): string => {
  if (percentage >= 100) {
    const goalMessages: Record<string, string[]> = {
      calories: ["🎉 Calorie goal hit! Perfect fueling!", "💯 Calories on point today!"],
      protein: ["💪 Protein goal crushed! Muscles are happy!", "🥇 Protein target smashed!"],
      carbs: ["⚡ Carb goal reached! Energy locked in!", "🔋 Carbs complete! Powered up!"],
      fats: ["🥑 Healthy fats goal achieved!", "✅ Fat target hit! Balance achieved!"],
      water: ["💧 Hydration complete! You're glowing!", "🌊 Water goal done! Stay refreshed!"],
    };
    const messages = goalMessages[type];
    return messages[Math.floor(Math.random() * messages.length)];
  }
  
  if (percentage >= 75) {
    return `Almost there! ${100 - Math.round(percentage)}% to go on ${type}!`;
  }
  
  if (percentage >= 50) {
    return `Halfway on ${type}! Keep the momentum! 💪`;
  }
  
  return `Good start on ${type}! You've got this! 🌟`;
};
