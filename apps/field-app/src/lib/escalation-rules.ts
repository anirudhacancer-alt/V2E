/**
 * Demo rule: suggest escalation when extraction indicates critical impact
 * or high/critical schedule risk.
 */
export function recommendEscalationFromAi(ai: {
  severity?: string | null;
  scheduleRisk?: string | null;
} | null): boolean {
  if (!ai) return false;
  if (ai.severity === "Critical") return true;
  const sr = ai.scheduleRisk;
  return sr === "High" || sr === "Critical";
}
