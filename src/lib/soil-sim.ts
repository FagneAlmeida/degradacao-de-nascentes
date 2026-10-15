export type PlotKind = "covered" | "bare";

export type PlotModel = {
  kind: PlotKind;
  integrity: number;
  storage: number;
  pond: number;
  clarity: number;
  wetness: number;
  canopy: number;
  seal: number;
  loose: number;
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
    canopy: 0,
    seal: 0,
    loose: 0,
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

/** `rain` is 0–1. `dt` is seconds of class time, shown as minutes of storm. */
export function stepPlot(plot: PlotModel, rain: number, stress: Stress, dt: number) {
  const covered = plot.kind === "covered";
  const cattle = !covered && stress.cattle;
  const tillage = !covered && stress.tillage;

  let through = rain;
  if (covered) {
    const caught = rain * (1 - plot.canopy) * 0.9;
    const evap = plot.canopy * 0.02;
    plot.canopy = clamp(plot.canopy + (caught * 3.2 - evap) * dt, 0, 1);
    through = Math.max(0, rain - caught);
  } else if (plot.canopy > 0) {
    plot.canopy = 0;
  }

  const impact = covered ? through * 0.12 : through;
  const sealGain = impact * (covered ? 0.015 : cattle ? 0.55 : 0.32);
  const sealLoss = plot.seal * (covered ? 0.09 : 0.008);
  plot.seal = clamp(plot.seal + (sealGain - sealLoss) * dt, 0, 1);

  let capacity = covered ? 0.9 : 0.46;
  if (!covered) capacity *= 1 - 0.7 * plot.seal;
  if (cattle) capacity *= 0.4;
  if (tillage) capacity *= 0.78;
  capacity *= 1 - plot.wetness * (covered ? 0.12 : 0.38);
  capacity *= 0.58 + 0.42 * plot.integrity;

  const infil = Math.min(through, Math.max(0, capacity));
  const runoff = Math.max(0, through - infil);

  const detach =
    impact *
    (covered ? 0.035 : 0.62) *
    (1.15 - 0.6 * plot.integrity) *
    (cattle ? 1.25 : 1) *
    (tillage ? 1.45 : 1);
  plot.loose = clamp(plot.loose + detach * dt, 0, 1);
  const transport = runoff * (0.35 + plot.loose * 0.9) * (covered ? 0.22 : 1) * (tillage ? 1.55 : 1);
  const sediment = Math.min(plot.loose / Math.max(dt, 0.001), transport);
  plot.loose = clamp(plot.loose - sediment * dt, 0, 1);

  const unit = 4.6;
  plot.cumRain += rain * unit * dt;
  plot.cumInfil += infil * unit * dt;
  plot.cumRunoff += runoff * unit * dt;
  plot.cumSediment += sediment * 7.4 * dt;

  plot.integrity = clamp(
    plot.integrity - sediment * 0.09 * dt - (tillage ? runoff * 0.02 * dt : 0),
    0.08,
    1,
  );

  const recharge = infil * (covered ? 0.4 : 0.07);
  const baseOut = plot.storage * (covered ? 0.05 : 0.018);
  plot.storage = clamp(plot.storage + (recharge - baseOut) * dt, 0, 1);
  const pondDrain = covered ? 0.4 : 0.62;
  plot.pond = clamp(plot.pond + runoff * 0.95 * dt - plot.pond * pondDrain * dt, 0, 1);

  const baseflow = plot.storage * (covered ? 0.72 : 0.26);
  const quick = plot.pond * (covered ? 0.1 : 0.9);
  plot.flowRate = clamp(baseflow + quick, 0, 1.25);
  plot.infilRate = infil;
  plot.runoffRate = runoff;
  plot.sedRate = sediment;

  const conc = sediment * (covered ? 0.35 : 2.6) + plot.pond * plot.loose * (covered ? 0.04 : 0.85);
  const settle = (1 - plot.clarity) * (covered ? 0.09 : 0.012 + (1 - plot.pond) * 0.02);
  let clarity = plot.clarity + (settle - conc * 0.5) * dt;
  if (cattle && (runoff > 0.04 || plot.pond > 0.04)) clarity -= 0.07 * dt;
  plot.clarity = clamp(clarity, 0.05, 1);

  const wetIn = infil * 0.85 + runoff * (covered ? 0.08 : 0.3);
  plot.wetness = clamp(plot.wetness + (wetIn - 0.035) * dt, 0, 1);
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
