import type { OwaspId, Severity } from "../components/FindingCard";
import type { TrafficLight } from "../types/analysis";

export type SecurityRank = {
  title: string;
  subtitle: string;
  emoji: string;
  level: number;
  icon: string;
};

export function securityRank(secureScore: number, trafficLight: TrafficLight): SecurityRank {
  if (trafficLight === "green" || secureScore >= 72) {
    return {
      title: "Guardián digital",
      subtitle: "Tu app está bien protegida. Seguí así.",
      emoji: "🛡️",
      level: 5,
      icon: "verified_user",
    };
  }
  if (trafficLight === "yellow" || secureScore >= 38) {
    return {
      title: "En entrenamiento",
      subtitle: "Vas bien, pero hay misiones por completar.",
      emoji: "📚",
      level: 3,
      icon: "school",
    };
  }
  if (secureScore >= 15) {
    return {
      title: "Modo alerta",
      subtitle: "Hay riesgos importantes antes de publicar.",
      emoji: "⚠️",
      level: 2,
      icon: "warning",
    };
  }
  return {
    title: "Escudo en riesgo",
    subtitle: "Priorizá las misiones urgentes de inmediato.",
    emoji: "🚨",
    level: 1,
    icon: "crisis_alert",
  };
}

export const CATEGORY_VISUAL: Record<
  OwaspId,
  { icon: string; metaphor: string; color: string }
> = {
  A01: {
    icon: "door_front",
    metaphor: "Como una puerta que cualquiera puede abrir",
    color: "from-[#F87171]/20 to-transparent",
  },
  A02: {
    icon: "key",
    metaphor: "Como dejar las llaves pegadas en la puerta",
    color: "from-[#FACC15]/20 to-transparent",
  },
  A03: {
    icon: "pest_control",
    metaphor: "Como aceptar paquetes sin revisar qué traen",
    color: "from-[#F87171]/20 to-transparent",
  },
  A04: {
    icon: "shield",
    metaphor: "Como un candado débil en datos importantes",
    color: "from-[#FACC15]/20 to-transparent",
  },
  A05: {
    icon: "settings_alert",
    metaphor: "Como dejar ventanas abiertas en tu casa digital",
    color: "from-[#FACC15]/20 to-transparent",
  },
  A06: {
    icon: "inventory_2",
    metaphor: "Como cajas de proveedores sin revisar",
    color: "from-primary/20 to-transparent",
  },
  A07: {
    icon: "passkey",
    metaphor: "Como una cerradura de login fácil de forzar",
    color: "from-[#F87171]/20 to-transparent",
  },
  A08: {
    icon: "folder_off",
    metaphor: "Como confiar en archivos sin verificar",
    color: "from-[#FACC15]/20 to-transparent",
  },
  A09: {
    icon: "visibility_off",
    metaphor: "Como no tener cámaras cuando pasa algo",
    color: "from-primary/20 to-transparent",
  },
  A10: {
    icon: "travel_explore",
    metaphor: "Como pedirle a tu servidor que visite sitios peligrosos",
    color: "from-[#F87171]/20 to-transparent",
  },
};

export function severityVisual(severity: Severity) {
  switch (severity) {
    case "high":
      return {
        label: "Urgente",
        quest: "Misión crítica",
        emoji: "🔴",
        icon: "local_fire_department",
        hint: "Atendela antes de lanzar tu app al público.",
        bar: "bg-[#F87171]",
        text: "text-[#F87171]",
        bg: "bg-[#F87171]/12",
        border: "border-[#F87171]/35",
      };
    case "medium":
      return {
        label: "Importante",
        quest: "Misión recomendada",
        emoji: "🟡",
        icon: "flag",
        hint: "No es emergencia, pero conviene planificarla pronto.",
        bar: "bg-[#FACC15]",
        text: "text-[#FACC15]",
        bg: "bg-[#FACC15]/12",
        border: "border-[#FACC15]/35",
      };
    default:
      return {
        label: "Para mejorar",
        quest: "Misión opcional",
        emoji: "🟢",
        icon: "eco",
        hint: "Buen hábito de seguridad cuando tengas tiempo.",
        bar: "bg-primary",
        text: "text-primary",
        bg: "bg-primary/12",
        border: "border-primary/35",
      };
  }
}

/** Convierte texto de recomendación en pasos accionables */
export function actionSteps(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
  if (parts.length <= 1) return [text];
  return parts.slice(0, 5);
}
