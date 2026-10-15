export type PlotKind = "covered" | "bare";

export type PlotModel = {
  kind: PlotKind;
  integrity: number;
  storage: number;
  pond: number;
  clarity: number;
  wetness: number;
  cumRain: number;
  cumInfil: number;
  cumRunoff: number;
  cumSediment: number;
  infilRate: number;
  runoffRate: number;
  sedRate: number;
  flowRate: number;
};

export type Stress = {
  cattle: boolean;
  tillage: boolean;
};

export function createPlot(kind: PlotKind): PlotModel {
  return {
    kind,
    integrity: 1,
    storage: 0.4,
    pond: 0,
    clarity: 0.94,
    wetness: kind === "covered" ? 0.18 : 0.08,
    cumRain: 0,
    cumInfil: 0,
    cumRunoff: 0,
    cumSediment: 0,
    infilRate: 0,
    runoffRate: 0,
    sedRate: 0,
    flowRate: 0.24,
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** `rain` is 0–1. `dt` is seconds. Covered and bare share the same rain. */
export function stepPlot(plot: PlotModel, rain: number, stress: Stress, dt: number) {
  const covered = plot.kind === "covered";
  const cattle = !covered && stress.cattle;
  const tillage = !covered && stress.tillage;

  const evap = covered ? 0.1 : 0.02;
  const available = Math.max(0, rain * (1 - evap));

  let capacity = covered ? 0.96 : 0.2;
  if (cattle) capacity *= 0.42;
  if (tillage) capacity *= 0.75;
  capacity *= 0.62 + 0.38 * plot.integrity;

  const infil = Math.min(available, capacity);
  const runoff = Math.max(0, available - infil);

  let erod = covered ? 0.08 : 0.82;
  if (cattle) erod *= 1.35;
  if (tillage) erod *= 1.7;
  erod *= 1.15 - 0.55 * plot.integrity;
  const impact = covered ? 0.18 : 1;
  const sediment = runoff * erod * impact * (0.35 + rain * 0.65);

  const unit = 5.4;
  plot.cumRain += rain * unit * dt;
  plot.cumInfil += infil * unit * dt;
  plot.cumRunoff += runoff * unit * dt;
  plot.cumSediment += sediment * 9.2 * dt;

  plot.integrity = clamp(plot.integrity - sediment * 0.03 * dt, 0.07, 1);

  const recharge = infil * (covered ? 0.34 : 0.06);
  plot.storage = clamp(plot.storage + (recharge - plot.storage * 0.012) * dt, 0, 1);
  plot.pond = clamp(plot.pond + runoff * 0.85 * dt - plot.pond * 0.55 * dt, 0, 1);

  plot.flowRate = plot.storage * 0.64 + plot.pond * (covered ? 0.1 : 1);
  plot.infilRate = infil;
  plot.runoffRate = runoff;
  plot.sedRate = sediment;

  const mud = sediment * (covered ? 0.45 : 3.1) + plot.pond * (covered ? 0.02 : 0.35);
  const recover = (1 - plot.clarity) * (covered ? 0.08 : 0.015);
  plot.clarity = clamp(plot.clarity + (recover - mud * 0.55) * dt, 0.05, 1);

  if (rain > 0.02) {
    plot.wetness = clamp(plot.wetness + (infil * 0.9 + runoff * 0.45) * dt, 0, 1);
  } else {
    plot.wetness = clamp(plot.wetness - 0.045 * dt, 0, 1);
  }
}

export function springPhrase(plot: PlotModel): string {
  if (plot.cumRain < 0.8 && plot.clarity > 0.72) return "Nascente límpida";
  const muddy = plot.clarity < 0.55;
  const weak = plot.flowRate < 0.16;
  const strong = plot.flowRate > 0.3;
  if (muddy && weak) return "Nascente turva e fraca";
  if (muddy && plot.integrity < 0.45) return "Nascente assoreada";
  if (muddy) return "Nascente turva";
  if (weak) return "Vazão em queda";
  if (strong && plot.clarity > 0.78) return "Nascente límpida e estável";
  if (plot.clarity > 0.78) return "Nascente límpida";
  return "Nascente em mudança";
}

export function soilPhrase(plot: PlotModel): string {
  if (plot.integrity > 0.92) return "Agregados firmes";
  if (plot.integrity > 0.75) return "Sulcos iniciais";
  if (plot.integrity > 0.48) return "Solo se fragmentando";
  return "Voçorocas — solo desmontado";
}

export function rainLabel(intensity: number): string {
  if (intensity < 0.28) return "Garoa";
  if (intensity < 0.52) return "Chuva moderada";
  if (intensity < 0.78) return "Chuva forte";
  return "Temporal";
}
