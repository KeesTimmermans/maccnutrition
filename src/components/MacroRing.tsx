interface MacroRingProps {
  value: number;
  max: number;
  label: string;
  color: "protein" | "carbs" | "fats" | "calories" | "sugar";
  size?: "sm" | "md" | "lg";
  unit?: string;
}

const colorClasses = {
  protein: "stroke-protein",
  carbs: "stroke-carbs",
  fats: "stroke-fats",
  calories: "stroke-calories",
  sugar: "stroke-sugar",
};

const bgColorClasses = {
  protein: "text-protein",
  carbs: "text-carbs",
  fats: "text-fats",
  calories: "text-calories",
  sugar: "text-sugar",
};

const sizeConfig = {
  sm: { size: 80, stroke: 6, textSize: "text-lg", labelSize: "text-xs" },
  md: { size: 100, stroke: 8, textSize: "text-xl", labelSize: "text-sm" },
  lg: { size: 140, stroke: 10, textSize: "text-3xl", labelSize: "text-base" },
};

export const MacroRing = ({ 
  value, 
  max, 
  label, 
  color, 
  size = "md",
  unit = "g"
}: MacroRingProps) => {
  const config = sizeConfig[size];
  const radius = (config.size - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: config.size, height: config.size }}>
        {/* Background circle */}
        <svg
          className="absolute inset-0 -rotate-90"
          width={config.size}
          height={config.size}
        >
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.stroke}
            className="text-muted/50"
          />
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`${colorClasses[color]} transition-all duration-700 ease-out`}
          />
        </svg>
        
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${config.textSize} ${bgColorClasses[color]}`}>
            {value}
          </span>
          <span className="text-muted-foreground text-xs">
            / {max}{unit}
          </span>
        </div>
      </div>
      <span className={`font-semibold ${config.labelSize} text-foreground`}>
        {label}
      </span>
    </div>
  );
};
