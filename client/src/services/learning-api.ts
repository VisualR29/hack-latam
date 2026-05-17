import { API_BASE } from "../config";

const HEALTH_URL = API_BASE ? `${API_BASE}/health` : "/health";

export async function fetchLearningPremiumAvailable(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL);
    if (!res.ok) return false;
    const data = (await res.json()) as { learningPremium?: boolean };
    return Boolean(data.learningPremium);
  } catch {
    return false;
  }
}
