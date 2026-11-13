import type { KeyboardEvent } from "react";
import type { StageProps } from "@/components/BarStage";
import { formatValue, fromFraction, nudge } from "@/lib/engine/scale";

const DASH = "3 2";

function Glove({ dashed }: { dashed?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-full p-[2px]" aria-hidden="true">
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
    <svg viewBox="0 0 24 24" className="size-full p-[2px]" aria-hidden="true">
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

// Rows of 6 that grow upward from the baseline.
function Pile({ n, metricId, dashed }: { n: number; metricId: string; dashed?: boolean }) {
  const Icon = metricId === "knockdowns" ? Glove : TapHand;
  return (
    <div className="flex w-full flex-wrap-reverse content-start">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="aspect-square w-1/6">
          <Icon dashed={dashed} />
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
  const redPile = <Pile n={Math.round(value)} metricId={metric.id} />;

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
          className="flex flex-1 touch-none flex-col border-b border-tick text-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
        >
          <div
            data-testid="stack-add"
            className="min-h-11 flex-1"
            onClick={() => onChange(nudge(metric, value, 1))}
          />
          <div data-testid="stack-pile" className="w-full" onClick={() => onChange(nudge(metric, value, -1))}>
            {redPile}
          </div>
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col justify-end border-b border-tick text-red">
          {redPile}
          {reveal && (
            <div data-testid="true-value" className="absolute inset-0 flex flex-col justify-end text-text">
              <Pile n={Math.round(actual)} metricId={metric.id} dashed />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
