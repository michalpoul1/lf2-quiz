interface Props {
  percentage: number; // 0-100, or -1 for "no data"
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export default function DonutChart({
  percentage,
  size = 64,
  strokeWidth = 5,
  label,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const noData = percentage < 0;
  const pct = noData ? 0 : Math.min(100, Math.max(0, percentage));
  const offset = circumference - (pct / 100) * circumference;

  const color =
    noData
      ? "#9ca3af"
      : pct >= 75
        ? "var(--color-correct)"
        : pct >= 50
          ? "var(--color-missed)"
          : "var(--color-wrong)";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-100 dark:text-gray-800"
        />
        {/* Progress arc */}
        {!noData && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-bold leading-none"
          style={{ fontSize: size * 0.28, color }}
        >
          {noData ? "—" : `${pct}%`}
        </span>
        {label && (
          <span className="text-[8px] text-gray-400 mt-0.5">{label}</span>
        )}
      </div>
    </div>
  );
}
