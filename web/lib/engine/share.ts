// One square per round: green for 80+, yellow for 40-79, red below 40.
function square(score: number): string {
  if (score >= 80) return "🟩";
  if (score >= 40) return "🟨";
  return "🟥";
}

export function shareText(name: string, puzzle: number, scores: number[], siteUrl: string): string {
  const total = scores.reduce((sum, score) => sum + score, 0);
  const max = scores.length * 100;
  return `${name} #${puzzle} — ${total}/${max}\n${scores.map(square).join("")}\n${siteUrl}`;
}
