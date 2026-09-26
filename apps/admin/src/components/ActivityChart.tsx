"use client";

import { useMemo, useState } from "react";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

type Series = { label: string; colour: string; dates: string[] };

const VIEW_W = 800;
const VIEW_H = 180;
const PAD_TOP = 12;
const PAD_BOTTOM = 18;

function bucketByDay(dates: string[], days: number) {
  const counts = new Array<number>(days).fill(0);
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const todayStart = midnight.getTime();

  for (const value of dates) {
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) continue;
    // 0 = today, days-1 = the oldest day still in range.
    const dayIndex = Math.floor((todayStart - time) / 86_400_000);
    if (dayIndex >= 0 && dayIndex < days) counts[days - 1 - dayIndex] += 1;
  }
  return counts;
}

function pointsFor(counts: number[], max: number) {
  const step = counts.length > 1 ? VIEW_W / (counts.length - 1) : 0;
  const usable = VIEW_H - PAD_TOP - PAD_BOTTOM;
  return counts
    .map((count, index) => {
      const x = index * step;
      const y = VIEW_H - PAD_BOTTOM - (max === 0 ? 0 : (count / max) * usable);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function axisLabels(days: number) {
  const format = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const ticks = 5;
  return Array.from({ length: ticks }, (_, index) => {
    const daysAgo = Math.round(((ticks - 1 - index) * (days - 1)) / (ticks - 1));
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - daysAgo);
    return format.format(date);
  });
}

/**
 * Reports and feedback per day, plotted from the rows already loaded for the
 * dashboard. The previous version drew a hardcoded polyline with invented date
 * labels and a range toggle that changed nothing.
 */
export default function ActivityChart({ series }: { series: Series[] }) {
  const [days, setDays] = useState<number>(30);

  const model = useMemo(() => {
    const buckets = series.map((entry) => ({ ...entry, counts: bucketByDay(entry.dates, days) }));
    const max = Math.max(1, ...buckets.flatMap((entry) => entry.counts));
    return {
      max,
      lines: buckets.map((entry) => ({
        ...entry,
        total: entry.counts.reduce((sum, count) => sum + count, 0),
        points: pointsFor(entry.counts, max),
      })),
    };
  }, [days, series]);

  const hasAnything = model.lines.some((line) => line.total > 0);

  return (
    <>
      <div className="panel-head">
        <div>
          <h2>Community activity</h2>
          <p>Reports and feedback received per day, over the selected range.</p>
        </div>
        <div className="segmented" role="group" aria-label="Chart range">
          {RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              aria-pressed={days === range.days}
              onClick={() => setDays(range.days)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-body">
        <div className="chart-legend">
          {model.lines.map((line) => (
            <span key={line.label}>
              <i className="legend-dot" style={{ background: line.colour }} aria-hidden="true" />
              {line.label} <strong className="mono">{line.total}</strong>
            </span>
          ))}
          <span className="muted" style={{ marginLeft: "auto" }}>
            Peak {model.max} / day
          </span>
        </div>

        {hasAnything ? (
          <>
            <svg
              className="chart"
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={model.lines
                .map((line) => `${line.label}: ${line.total} in the last ${days} days`)
                .join(". ")}
            >
              <g className="chart-grid">
                {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                  const y = PAD_TOP + fraction * (VIEW_H - PAD_TOP - PAD_BOTTOM);
                  return <line key={fraction} x1="0" y1={y} x2={VIEW_W} y2={y} />;
                })}
              </g>
              {model.lines.map((line, index) => (
                <polyline
                  key={line.label}
                  points={line.points}
                  fill="none"
                  stroke={line.colour}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray={index === 1 ? "6 5" : undefined}
                />
              ))}
            </svg>
            <div className="chart-axis">
              {axisLabels(days).map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
            </div>
          </>
        ) : (
          <div className="empty">
            <strong>Nothing in this range</strong>
            <p>Reports and feedback from the last {days} days will be plotted here.</p>
          </div>
        )}
      </div>
    </>
  );
}
