import { BarStage, type StageProps } from "@/components/BarStage";
import { SilhouetteStage } from "@/components/SilhouetteStage";
import { StackStage } from "@/components/stages/StackStage";
import { fromFraction } from "@/lib/engine/scale";
import type { Metric, MetricId } from "@/lib/engine/types";

export type StageKind = "bar" | "silhouette" | "stack" | "dial" | "tach" | "timeline" | "tank";

export const STAGE_BY_METRIC: Partial<Record<MetricId, StageKind>> = {
  knockdowns: "stack",
  sub_wins: "stack",
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
    case "stack":
      return <StackStage {...props} />;
    default:
      return <BarStage {...props} />;
  }
}
