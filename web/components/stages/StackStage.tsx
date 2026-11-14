import type { MouseEvent } from "react";
import type { StageProps } from "@/components/BarStage";
import { arrowKeys } from "@/components/stages/gauge";
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

// A line at every full row of 6, so a pile can be counted at a glance; `labels` writes the counts on the left.
function Rows({ max, labels }: { max: number; labels?: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col-reverse">
      {Array.from({ length: Math.floor(max / 6) }, (_, i) => (
        <div key={i} className="relative aspect-[6/1] w-full shrink-0 border-t border-line">
          {labels && (
            <span className="absolute -left-8 top-0 w-6 -translate-y-1/2 text-right text-[11px] text-muted tabular-nums">{(i + 1) * 6}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function StackStage({ metric, refValue, value, onChange, actual }: StageProps) {
  const reveal = actual !== undefined;
  const interactive = onChange && !reveal;
  const key = arrowKeys(metric, value, onChange);
  const max = fromFraction(metric, 1);

  // Fixed height: 4 rows of icons (knockdowns reach 22) still leave a 44 px+ add area at the axis maximum.
  return (
    <div data-testid="stack-stage" className="flex h-56 flex-none gap-3 pr-2 pl-9">
      <div className="relative flex flex-1 flex-col justify-end border-b border-tick text-blue">
        <Rows max={max} labels />
        <Pile n={Math.round(refValue)} metricId={metric.id} />
      </div>
      {interactive ? (
        <div
          role="slider"
          tabIndex={0}
          aria-label="Your estimate"
          aria-orientation="vertical"
          aria-valuemin={fromFraction(metric, 0)}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={formatValue(metric, value)}
          onKeyDown={key}
          // Any tap that is not on a drawn icon adds one; the pile stops its own taps.
          onClick={() => onChange(nudge(metric, value, 1))}
          className="relative flex flex-1 touch-none flex-col border-b border-tick text-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
        >
          <Rows max={max} />
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
          <Rows max={max} />
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
