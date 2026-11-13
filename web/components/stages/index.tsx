import { BarStage, type StageProps } from "@/components/BarStage";
import { SilhouetteStage } from "@/components/SilhouetteStage";
import { DialStage } from "@/components/stages/DialStage";
import { StackStage } from "@/components/stages/StackStage";
import { TachStage } from "@/components/stages/TachStage";
import { TankStage } from "@/components/stages/TankStage";
import { TimelineStage } from "@/components/stages/TimelineStage";
import { fromFraction } from "@/lib/engine/scale";
import type { Metric, MetricId } from "@/lib/engine/types";

export type StageKind = "bar" | "silhouette" | "stack" | "dial" | "tach" | "timeline" | "tank";

export const STAGE_BY_METRIC: Partial<Record<MetricId, StageKind>> = {
  knockdowns: "stack",
  sub_wins: "stack",
  win_pct: "dial",
  finish_rate: "dial",
  slpm: "tach",
  td_avg: "tach",
  age: "timeline",
  career_sig: "tank",
};

export function stageKind(metric: Metric): StageKind {
  return metric.round === "silhouette" ? "silhouette" : (STAGE_BY_METRIC[metric.id] ?? "bar");
}

// A stack counts up from nothing; everything else starts mid-axis.
export function startValue(metric: Metric): number {
  return fromFraction(metric, stageKind(metric) === "stack" ? 0 : 0.5);
}

export function Stage(props: StageProps) {
  switch (stageKind(props.metric)) {
    case "silhouette":
      return <SilhouetteStage {...props} />;
    case "dial":
      return <DialStage {...props} />;
    case "tach":
      return <TachStage {...props} />;
    case "timeline":
      return <TimelineStage {...props} />;
    case "tank":
      return <TankStage {...props} />;
    case "stack":
      return <StackStage {...props} />;
    default:
      return <BarStage {...props} />;
  }
}
