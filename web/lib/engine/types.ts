// Shapes of the data the engine works on (spec sections 5.2, 5.6, 6.1).

export type MetricId = string;
export type FighterId = string;

// One entry of data/fighters.json.
export type Fighter = {
  id: FighterId;
  name: string;
  dob: string | null; // YYYY-MM-DD
  deceased: boolean;
  hasImage: boolean;
  trackedFights: number;
  metrics: Record<MetricId, number>; // a key is present only when eligible
};

// One entry of data/metrics.json.
export type Metric = {
  id: MetricId;
  label: string;
  unit: string;
  round: "silhouette" | "bar";
  scale: "linear" | "log";
  snap: number | null;
  min: number; // slider range
  max: number;
  step: number; // scoring unit
};

export type Round = { metric: MetricId; ref: FighterId; target: FighterId };
