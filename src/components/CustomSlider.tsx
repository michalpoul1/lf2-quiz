"use client";

interface Mark {
  value: number;
  label?: string;
}

interface Props {
  value: number;
  min: number;
  max: number;
  step?: number;
  marks: Mark[];
  label?: string;
  unit?: string;
  subtitle?: string;
  onChange: (value: number) => void;
}

export default function CustomSlider({
  value,
  min,
  max,
  step = 1,
  marks,
  label,
  unit,
  subtitle,
  onChange,
}: Props) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div>
      {/* Current value display */}
      <div className="text-center mb-3">
        <span className="text-4xl font-bold text-[var(--color-primary)] dark:text-blue-400">
          {value}
        </span>
        {unit && (
          <span className="text-base text-gray-400 ml-1.5">{unit}</span>
        )}
        {label && (
          <p className="text-xs text-gray-400 mt-0.5">{label}</p>
        )}
      </div>

      {/* Slider track */}
      <div className="relative px-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="custom-slider w-full"
          style={
            {
              "--slider-pct": `${pct}%`,
            } as React.CSSProperties
          }
        />
      </div>

      {/* Marks */}
      <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
        {marks.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium tap-highlight transition-all ${
              value === m.value
                ? "bg-[var(--color-primary)] text-white scale-105"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {m.label || m.value}
          </button>
        ))}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-xs text-gray-400 text-center mt-2">{subtitle}</p>
      )}
    </div>
  );
}
