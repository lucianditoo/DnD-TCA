import type { CriticalProfile, MoneyCost } from "./types.js";

export const cost = (value: number | null, currency: MoneyCost["currency"], text?: string): MoneyCost => ({
  value,
  currency,
  text: text ?? (value === null ? "—" : `${value} ${currency}`),
});

export const crit = (text: string): CriticalProfile => {
  if (text === "—") return { threatFrom: null, multiplier: null, text };
  const normalized = text.replace("×", "x").trim();
  const match = normalized.match(/^(?:(\d+)-20\/)?x(\d+)$/i);
  if (match) {
    return {
      threatFrom: match[1] ? Number(match[1]) : 20,
      multiplier: Number(match[2]),
      text,
    };
  }
  return { threatFrom: null, multiplier: null, text };
};
