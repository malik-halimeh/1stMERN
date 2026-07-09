export interface ColumnPoint {
  label: string;
  value: number;
  tooltip: string;
}

interface ColumnChartProps {
  points: ColumnPoint[];
  /** Formats a y-axis tick value (e.g. cents → "$1.2K") */
  formatTick: (value: number) => string;
  heightClass?: string;
}

/** Round a max value up to a clean axis ceiling (1/2/5 × 10^n) */
const cleanCeiling = (max: number) => {
  if (max <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 5, 10]) {
    if (m * pow >= max) return m * pow;
  }
  return 10 * pow;
};

const TICKS = [1, 0.75, 0.5, 0.25]; // gridline fractions of the ceiling, top→down

/**
 * Dependency-free single-series column chart following the design system's
 * mark specs: ≤24px columns, 4px rounded data-end, square baseline, 2px
 * surface gaps, hairline gridlines, per-mark hover tooltip. Single series —
 * the surrounding card title names it, so no legend.
 */
export function ColumnChart({ points, formatTick, heightClass = 'h-56' }: ColumnChartProps) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-text-secondary py-8 text-center">
        No data in this window.
      </p>
    );
  }

  const ceiling = cleanCeiling(Math.max(...points.map((p) => p.value)));

  return (
    <>
      <div className="flex">
        {/* Y-axis tick labels */}
        <div className={`relative w-14 ${heightClass} mr-2 shrink-0`}>
          {TICKS.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 text-caption text-text-muted tabular-nums pr-1"
              style={{ top: `${(1 - t) * 100}%` }}
            >
              {formatTick(ceiling * t)}
            </span>
          ))}
          <span className="absolute right-0 bottom-0 translate-y-1/2 text-caption text-text-muted pr-1">
            {formatTick(0)}
          </span>
        </div>
        {/* Plot area */}
        <div className={`relative flex-grow ${heightClass}`}>
          {TICKS.map((t) => (
            <div
              key={t}
              className="absolute left-0 right-0 border-t border-dashboard-section-bg"
              style={{ top: `${(1 - t) * 100}%` }}
            />
          ))}
          <div className="absolute left-0 right-0 bottom-0 border-t border-text-disabled" />
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {points.map((p) => (
              <div
                key={p.label}
                className="relative flex-1 h-full flex items-end justify-center group"
              >
                <div
                  className="w-full max-w-[24px] bg-primary rounded-t-[4px] group-hover:bg-primary-dark transition-colors"
                  style={{ height: `${Math.max((p.value / ceiling) * 100, 0.5)}%` }}
                />
                <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-text-primary text-white text-caption rounded-btn px-2.5 py-1.5 whitespace-nowrap shadow-level2 z-10">
                  {p.tooltip}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* X-axis endpoint labels */}
      <div className="flex justify-between mt-2 ml-16 text-caption text-text-muted">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </>
  );
}

export default ColumnChart;
