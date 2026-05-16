import type { Finding, TrafficLight } from "../schemas/findings.js";
import { FindingSchema } from "../schemas/findings.js";

export function aggregateRisk(findingsInput: Finding[]): {
  findings: Finding[];
  riskScore: number;
  secureScore: number;
  trafficLight: TrafficLight;
} {
  const dedupKeys = new Set<string>();
  const findings: Finding[] = [];

  for (const candidate of findingsInput) {
    const parsed = FindingSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const f = parsed.data;

    const key = `${f.ruleId}|${f.file}|${f.line ?? 0}|${f.title.slice(0, 96)}`;
    if (dedupKeys.has(key)) continue;
    dedupKeys.add(key);
    findings.push(f);
  }

  let high = 0;
  let medium = 0;
  let low = 0;

  for (const f of findings) {
    if (f.severity === "high") high++;
    else if (f.severity === "medium") medium++;
    else low++;
  }

  const rawScore = Math.min(
    100,
    Math.round(high * 22 + medium * 11 + low * 4),
  );

  const riskScore = findings.length === 0 ? 0 : rawScore;
  const secureScore = 100 - riskScore;

  // Semáforo basado en secureScore: alto = verde (seguro), bajo = rojo (peligroso)
  let trafficLight: TrafficLight = "green";
  if (secureScore >= 72) trafficLight = "green";
  else if (secureScore >= 38) trafficLight = "yellow";
  else trafficLight = "red";

  return {
    findings,
    riskScore,
    secureScore,
    trafficLight,
  };
}
