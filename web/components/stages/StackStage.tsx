import type { KeyboardEvent, MouseEvent } from "react";
import type { StageProps } from "@/components/BarStage";
import { formatValue, fromFraction, nudge } from "@/lib/engine/scale";

const DASH = "3 2";

function Glove({ dashed }: { dashed?: boolean }) {
  return (
    <svg viewBox="4 3 16 20" className="size-full" aria-hidden="true">
      <path
        d="M6 11a6 6 0 0 1 12 0v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4zM9 19v3h6v-3"
        fill={dashed ? "none" : "currentColor"}
        stroke={dashed ? "currentColor" : "none"}
        strokeWidth="1.5"
        strokeDasharray={dashed ? DASH : undefined}
      />
    </svg>
  );
}

function TapHand({ dashed }: { dashed?: boolean }) {
  return (
    <svg viewBox="4 3 16 20" className="size-full" aria-hidden="true">
      <path
        d="M5 12V7h3v-3h3v3h2V4h3v3h2v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"
        fill={dashed ? "none" : "currentColor"}
        stroke={dashed ? "currentColor" : "none"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeDasharray={dashed ? DASH : undefined}
      />
    </svg>
  );
}

// Rows of 6 that grow upward from the baseline. The pile is only as wide as its drawn columns,
// so its box (and any tap handler on it) covers drawn icons plus the blank cells of the top row.
function Pile({ n, metricId, dashed, ...rest }: { n: number; metricId: string; dashed?: boolean; "data-testid"?: string; onClick?: (e: MouseEvent) => void }) {
  const cols = Math.min(n, 6) || 1;
  return (
    <div className="flex flex-wrap-reverse content-start" style={{ width: `${(cols / 6) * 100}%` }} {...rest}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="aspect-square" style={{ width: `${100 / cols}%` }}>
          {metricId === "knockdowns" ? <Glove dashed={dashed} /> : <TapHand dashed={dashed} />}
        </div>
      ))}
    </div>
  );
}

export function StackStage({ metric, refValue, value, onChange, actual }: StageProps) {
  const reveal = actual !== undefined;
  const interactive = onChange && !reveal;
  const key = (e: KeyboardEvent) => {
    const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (!dir || !onChange) return;
    e.preventDefault();
    onChange(nudge(metric, value, dir as 1 | -1));
  };

  // Fixed height: 4 rows of icons (knockdowns reach 22) still leave a 44 px+ add area at the axis maximum.
  return (
    <div data-testid="stack-stage" className="flex h-56 flex-none gap-3 px-2">
      <div className="flex flex-1 flex-col justify-end border-b border-tick text-blue">
        <Pile n={Math.round(refValue)} metricId={metric.id} />
      </div>
      {interactive ? (
        <div
          role="slider"
          tabIndex={0}
          aria-label="Your estimate"
          aria-orientation="vertical"
          aria-valuemin={fromFraction(metric, 0)}
          aria-valuemax={fromFraction(metric, 1)}
          aria-valuenow={value}
          aria-valuetext={formatValue(metric, value)}
          onKeyDown={key}
          // Any tap that is not on a drawn icon adds one; the pile stops its own taps.
          onClick={() => onChange(nudge(metric, value, 1))}
          className="flex flex-1 touch-none flex-col border-b border-tick text-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
        >
          <div data-testid="stack-add" className="min-h-11 flex-1" />
          <Pile
            n={Math.round(value)}
            metricId={metric.id}
            data-testid="stack-pile"
            onClick={(e) => {
              // The blank cells of a partial top row are part of the pile's box but belong to the add area.
              if (e.target === e.currentTarget) return;
              e.stopPropagation();
              onChange(nudge(metric, value, -1));
            }}
          />
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col justify-end border-b border-tick text-red">
          <Pile n={Math.round(value)} metricId={metric.id} />
          {reveal && (
            <div data-testid="true-value" className="absolute inset-0 flex flex-col justify-end text-truth">
              <Pile n={Math.round(actual)} metricId={metric.id} dashed />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
