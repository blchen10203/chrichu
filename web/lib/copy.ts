import type { Metric } from "@/lib/engine/types";

type Copy = { category: string; question: string; short: string };

// {name} is the target; {name's} is its possessive.
const table: Record<string, [category: string, question: string, short: string]> = {
  height: ["HEIGHT", "How tall is {name}?", "Height"],
  reach: ["REACH", "How long is {name's} reach?", "Reach"],
  slpm: ["STRIKING", "How many significant strikes does {name} land per minute?", "Strikes per minute"],
  career_sig: ["STRIKING", "How many significant strikes has {name} landed in the UFC?", "Career strikes"],
  knockdowns: ["STRIKING", "How many knockdowns has {name} scored in the UFC?", "Knockdowns"],
  td_avg: ["GRAPPLING", "How many takedowns does {name} land per 15 minutes?", "Takedowns per 15 min"],
  sub_wins: ["GRAPPLING", "How many UFC fights has {name} won by submission?", "Submission wins"],
  win_pct: ["RECORD", "What percentage of UFC fights has {name} won?", "Win %"],
  finish_rate: ["RECORD", "What percentage of {name's} UFC wins are finishes?", "Finish rate"],
  age: ["PROFILE", "How old is {name}?", "Age"],
};

export function metricCopy(metric: Metric, targetName: string): Copy {
  const row = table[metric.id];
  if (!row) {
    return { category: metric.label.toUpperCase(), question: `${metric.label}: ${targetName}?`, short: metric.label };
  }
  const possessive = targetName.endsWith("s") ? `${targetName}'` : `${targetName}'s`;
  const [category, question, short] = row;
  return {
    category,
    question: question.replace("{name's}", possessive).replace("{name}", targetName),
    short,
  };
}
