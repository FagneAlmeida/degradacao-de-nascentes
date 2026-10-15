import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { BookOpen, CloudRain, Footprints, RotateCcw, Shovel, TreePine } from "lucide-react";
import {
  createPlot,
  rainLabel,
  soilPhrase,
  springPhrase,
  stepPlot,
  type PlotModel,
} from "@/lib/soil-sim";
import { createVisual, drawScene, stepVisual, type Visual } from "@/lib/soil-draw";
import { Manual } from "@/components/manual";

type Hist = {
  flowA: number[];
  flowB: number[];
  sedA: number[];
  sedB: number[];
};

type Snap = {
  raining: boolean;
  intensity: number;
  cattle: boolean;
  tillage: boolean;
  elapsed: number;
  covered: PlotModel;
  bare: PlotModel;
  hist: Hist;
  note: string;
};

const HIST_LEN = 42;

function seedLine(v: number) {
  return Array.from({ length: 14 }, () => v);
}

function push(arr: number[], v: number) {
  arr.push(Math.max(0, Math.min(1, v)));
  if (arr.length > HIST_LEN) arr.shift();
}

function fmt(n: number) {
  const digits = n < 10 ? 1 : 0;
  return n.toFixed(digits).replace(".", ",");
}

function lecture(
  raining: boolean,
  rainAmount: number,
  cattle: boolean,
  tillage: boolean,
) {
  if (cattle && tillage) {
    return "Pisoteio e cultivo morro abaixo juntos: o solo compacta, parte em blocos e a enxurrada leva os fragmentos até a nascente. A comunidade perde água para beber e para produzir.";
  }
  if (cattle) {
    return "O gado fecha os poros com o pisoteio. Quase nada infiltra, a enxurrada cresce e o rebanho na margem contamina a fonte da comunidade.";
  }
  if (tillage) {
    return "O cultivo morro abaixo vira caminho da enxurrada. O sulco aprofunda, o solo se fragmenta e a nascente assoreia.";
  }
  if (!raining && rainAmount < 0.4) {
    return "Os dois cortes recebem a mesma chuva. À esquerda, a encosta com cobertura. À direita, o solo desmatado. Clique no céu e compare o que chega em cada nascente.";
  }
  if (!raining) {
    return "A chuva parou, mas o estrago fica. Com mata, a nascente segue límpida: a água que infiltrou ainda alimenta o lençol. No solo nu, o fluxo cai e o barro assoreia o olho d'água.";
  }
  return "Mesma chuva nos dois lados. A copa segura a garoa e amortece a gota. No solo nu a superfície sela, a água escorre, arranca fragmentos e turva a nascente.";
}

function communityUse(
  plot: PlotModel,
  kind: "covered" | "bare",
  cattle: boolean,
  tillage: boolean,
) {
  if (plot.cumRain < 0.8) {
    return kind === "covered"
      ? "Protegida pela mata. Clique no céu para começar a comparação."
      : "Sem cobertura. A mesma chuva vai mostrar escoamento, erosão e sedimento.";
  }
  if (kind === "covered") {
    if (plot.clarity > 0.72 && plot.flowRate > 0.2) {
      return "Serve para beber e para a produção. Pouco sedimento, vazão estável.";
    }
    return "A vegetação segurou o solo. A fonte continua própria para a comunidade.";
  }
  if (cattle && plot.clarity < 0.7) {
    return "O pisoteio compacta o solo e leva sujeira do rebanho até a fonte.";
  }
  if (tillage && plot.integrity < 0.8) {
    return "O cultivo morro abaixo abriu sulco. O solo se fragmentou e assoreou a nascente.";
  }
  if (plot.clarity < 0.55 || plot.integrity < 0.55) {
    return "Água turva e fonte assoreada. Compromete o consumo e a produção.";
  }
  return "A enxurrada já carrega sedimento. A nascente começa a perder qualidade.";
}

function makeSnap(
  covered: PlotModel,
  bare: PlotModel,
  raining: boolean,
  intensity: number,
  cattle: boolean,
  tillage: boolean,
  elapsed: number,
  hist: Hist,
): Snap {
  return {
    raining,
    intensity,
    cattle,
    tillage,
    elapsed,
    covered: { ...covered },
    bare: { ...bare },
    hist: {
      flowA: hist.flowA.slice(),
      flowB: hist.flowB.slice(),
      sedA: hist.sedA.slice(),
      sedB: hist.sedB.slice(),
    },
    note: lecture(raining, Math.max(covered.cumRain, bare.cumRain), cattle, tillage),
  };
}

function Series({ a, b, label }: { a: number[]; b: number[]; label: string }) {
  const w = 320;
  const h = 96;
  const line = (arr: number[]) => {
    if (arr.length < 2) return "";
    return arr
      .map((v, i) => {
        const x = (i / (arr.length - 1)) * (w - 8) + 4;
        const y = 10 + (1 - Math.max(0, Math.min(1, v))) * (h - 20);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  };
  return (
    <figure className="min-w-0 flex-1">
      <figcaption className="mb-2 text-sm font-medium text-ink">{label}</figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" role="img" aria-label={label}>
        <path
          d={line(a)}
          fill="none"
          stroke="var(--color-canopy)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={line(b)}
          fill="none"
          stroke="var(--color-clay)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </figure>
  );
}

function Stat({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "canopy" | "clay";
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 0.01)) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-medium tabular-nums text-ink">{fmt(value)}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div
          className={tone === "canopy" ? "h-full rounded-full bg-canopy" : "h-full rounded-full bg-clay"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Simulator() {
  const coveredRef = useRef(createPlot("covered"));
  const bareRef = useRef(createPlot("bare"));
  const coveredVis = useRef<Visual>(createVisual("covered"));
  const bareVis = useRef<Visual>(createVisual("bare"));
  const canvasA = useRef<HTMLCanvasElement>(null);
  const canvasB = useRef<HTMLCanvasElement>(null);
  const rainRef = useRef({ on: false, intensity: 0.58 });
  const stressRef = useRef({ cattle: false, tillage: false });
  const elapsedRef = useRef(0);
  const histRef = useRef<Hist>({
    flowA: seedLine(0.22),
    flowB: seedLine(0.22),
    sedA: seedLine(0),
    sedB: seedLine(0),
  });
  const motionRef = useRef(true);

  const [snap, setSnap] = useState<Snap>(() =>
    makeSnap(
      coveredRef.current,
      bareRef.current,
      false,
      0.58,
      false,
      false,
      0,
      histRef.current,
    ),
  );
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    motionRef.current = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    let uiAcc = 0;
    let histAcc = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const rain = rainRef.current.on ? rainRef.current.intensity : 0;
      if (rainRef.current.on) elapsedRef.current += dt;
      const stress = stressRef.current;
      stepPlot(coveredRef.current, rain, stress, dt);
      stepPlot(bareRef.current, rain, stress, dt);
      stepVisual(coveredVis.current, coveredRef.current, rain, false, dt);
      stepVisual(bareVis.current, bareRef.current, rain, stress.tillage, dt);
      const time = elapsedRef.current;
      const opts = {
        tillage: stress.tillage,
        cattle: stress.cattle,
        time,
        motion: motionRef.current,
        raining: rain > 0,
      };
      if (canvasA.current) drawScene(canvasA.current, coveredRef.current, coveredVis.current, opts);
      if (canvasB.current) {
        drawScene(canvasB.current, bareRef.current, bareVis.current, opts);
      }
      histAcc += dt;
      if (histAcc >= 0.45) {
        histAcc = 0;
        push(histRef.current.flowA, coveredRef.current.flowRate / 1.15);
        push(histRef.current.flowB, bareRef.current.flowRate / 1.15);
        push(histRef.current.sedA, coveredRef.current.sedRate / 1.35);
        push(histRef.current.sedB, bareRef.current.sedRate / 1.35);
      }
      uiAcc += dt;
      if (uiAcc >= 0.25) {
        uiAcc = 0;
        setSnap(
          makeSnap(
            coveredRef.current,
            bareRef.current,
            rainRef.current.on,
            rainRef.current.intensity,
            stress.cattle,
            stress.tillage,
            elapsedRef.current,
            histRef.current,
          ),
        );
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  function toggleRain() {
    rainRef.current.on = !rainRef.current.on;
    setSnap((s) => ({ ...s, raining: rainRef.current.on }));
  }

  function setIntensity(value: number) {
    rainRef.current.intensity = value;
    setSnap((s) => ({ ...s, intensity: value }));
  }

  function setCattle(value: boolean) {
    stressRef.current.cattle = value;
    setSnap((s) => ({ ...s, cattle: value }));
  }

  function setTillage(value: boolean) {
    stressRef.current.tillage = value;
    setSnap((s) => ({ ...s, tillage: value }));
  }

  function reset() {
    coveredRef.current = createPlot("covered");
    bareRef.current = createPlot("bare");
    coveredVis.current = createVisual("covered");
    bareVis.current = createVisual("bare");
    rainRef.current.on = false;
    stressRef.current = { cattle: false, tillage: false };
    elapsedRef.current = 0;
    histRef.current = {
      flowA: seedLine(0.22),
      flowB: seedLine(0.22),
      sedA: seedLine(0),
      sedB: seedLine(0),
    };
    setSnap(
      makeSnap(
        coveredRef.current,
        bareRef.current,
        false,
        rainRef.current.intensity,
        false,
        false,
        0,
        histRef.current,
      ),
    );
  }

  const maxInfil = Math.max(snap.covered.cumInfil, snap.bare.cumInfil, 1);
  const maxRun = Math.max(snap.covered.cumRunoff, snap.bare.cumRunoff, 1);
  const maxSed = Math.max(snap.covered.cumSediment, snap.bare.cumSediment, 1);
  const sedRatio = snap.bare.cumSediment / Math.max(snap.covered.cumSediment, 0.35);
  const showRatio = snap.bare.cumSediment > 1.2;

  return (
    <main className="mx-auto max-w-6xl px-4 pt-4 pb-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-xs font-medium tracking-wide text-canopy">
            Trabalho 20 · Comunidades rurais
          </p>
          <h1 className="mt-1 text-2xl text-ink sm:text-3xl">Degradação de nascentes</h1>
        </div>
        <p className="max-w-xl text-sm leading-snug text-muted">
          Desmatamento, erosão, criação animal e uso inadequado do solo comprometem
          a água para consumo e produção.
        </p>
      </header>

      <div className="sticky top-0 z-10 -mx-4 mt-3 border-b border-line bg-paper px-4 py-3 sm:mx-0 sm:rounded-2xl sm:border sm:shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleRain}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-canopy px-5 text-sm font-medium text-paper"
          >
            <CloudRain className="size-4" aria-hidden="true" />
            {snap.raining ? "Parar chuva" : "Soltar chuva"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-medium text-ink"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Recomeçar
          </button>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={manualOpen}
            onClick={() => setManualOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-card px-4 text-sm font-medium text-ink"
          >
            <BookOpen className="size-4" aria-hidden="true" />
            Manual
          </button>
          <p className="text-sm text-muted">
            {snap.raining
              ? `${Math.max(1, Math.floor(snap.elapsed))} min de chuva`
              : snap.elapsed > 0.4
                ? "Chuva pausada"
                : "À espera da chuva"}
          </p>
        </div>
        <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <label className="block">
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-ink">Intensidade da chuva</span>
              <span className="text-canopy">{rainLabel(snap.intensity)}</span>
            </span>
            <input
              className="rain-range"
              type="range"
              min={8}
              max={100}
              value={Math.round(snap.intensity * 100)}
              aria-valuetext={rainLabel(snap.intensity)}
              onChange={(e) => setIntensity(Number(e.target.value) / 100)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={snap.cattle}
              onClick={() => setCattle(!snap.cattle)}
              className={
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-medium " +
                (snap.cattle
                  ? "border-clay bg-clay text-paper"
                  : "border-line bg-card text-ink")
              }
            >
              <Footprints className="size-4" aria-hidden="true" />
              Criação animal
            </button>
            <button
              type="button"
              aria-pressed={snap.tillage}
              onClick={() => setTillage(!snap.tillage)}
              className={
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-medium " +
                (snap.tillage
                  ? "border-clay bg-clay text-paper"
                  : "border-line bg-card text-ink")
              }
            >
              <Shovel className="size-4" aria-hidden="true" />
              Cultivo morro abaixo
            </button>
          </div>
        </div>
        <ol className="mt-1 flex flex-col gap-1 text-sm text-muted sm:flex-row sm:flex-wrap sm:gap-x-5">
          <li>1. Clique no céu</li>
          <li>2. Regule a intensidade</li>
          <li>3. Compare escoamento, erosão e a cor de cada nascente</li>
        </ol>
      </div>

      <p aria-live="polite" className="mt-3 max-w-3xl text-sm leading-snug text-ink sm:text-base">
        {snap.note}
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Stage
          title="Com cobertura vegetal"
          kicker="A mata protege o solo e a fonte"
          icon={<TreePine className="size-5 text-canopy" aria-hidden="true" />}
          canvasRef={canvasA}
          plot={snap.covered}
          tone="canopy"
          raining={snap.raining}
          onToggle={toggleRain}
          maxInfil={maxInfil}
          maxRun={maxRun}
          maxSed={maxSed}
          use={communityUse(snap.covered, "covered", snap.cattle, snap.tillage)}
        />
        <Stage
          title="Solo exposto"
          kicker="Desmatado — sem proteção"
          icon={<Shovel className="size-5 text-clay" aria-hidden="true" />}
          canvasRef={canvasB}
          plot={snap.bare}
          tone="clay"
          raining={snap.raining}
          onToggle={toggleRain}
          maxInfil={maxInfil}
          maxRun={maxRun}
          maxSed={maxSed}
          use={communityUse(snap.bare, "bare", snap.cattle, snap.tillage)}
        />
      </div>

      {showRatio && (
        <p className="mt-4 text-sm font-medium text-clay">
          O solo exposto já carregou {fmt(sedRatio)} vezes mais sedimento até a nascente.
          {snap.covered.clarity > 0.7 && snap.bare.clarity < 0.6
            ? " A fonte da mata ainda serve à comunidade. A do solo nu, não."
            : ""}
        </p>
      )}

      <section className="mt-6 rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-4 text-sm text-muted">
          <h2 className="text-lg text-ink">Durante a demonstração</h2>
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-canopy" aria-hidden="true" />
            Com vegetação
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-clay" aria-hidden="true" />
            Solo exposto
          </span>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Series a={snap.hist.flowA} b={snap.hist.flowB} label="Vazão da nascente" />
          <Series a={snap.hist.sedA} b={snap.hist.sedB} label="Sedimentos em transporte" />
        </div>
        <ul className="mt-4 grid gap-2 text-sm leading-relaxed text-muted sm:grid-cols-3">
          <li>Olhe para onde a água vai: para dentro do solo ou encosta abaixo.</li>
          <li>Veja se o solo se parte em blocos e desce até a água.</li>
          <li>Pare a chuva e compare a cor e a força de cada nascente.</li>
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Cada segundo da aula vale cerca de um minuto de chuva. Os índices comparam
          os dois lados — não são milímetros medidos no campo.
        </p>
      </section>
      <Manual open={manualOpen} onClose={() => setManualOpen(false)} />
    </main>
  );
}

function Stage({
  title,
  kicker,
  icon,
  canvasRef,
  plot,
  tone,
  raining,
  onToggle,
  maxInfil,
  maxRun,
  maxSed,
  use,
}: {
  title: string;
  kicker: string;
  icon: ReactNode;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  plot: PlotModel;
  tone: "canopy" | "clay";
  raining: boolean;
  onToggle: () => void;
  maxInfil: number;
  maxRun: number;
  maxSed: number;
  use: string;
}) {
  const muddy = plot.clarity < 0.55;
  const share = plot.cumRain > 0.5 ? Math.round((plot.cumRunoff / plot.cumRain) * 100) : null;
  const soil =
    plot.kind === "bare" && plot.seal > 0.45 && plot.integrity > 0.72
      ? "Superfície selada"
      : soilPhrase(plot);
  const note =
    plot.kind === "covered" && plot.canopy > 0.45
      ? "Copa molhada — a gota chega mais fraca"
      : plot.kind === "bare" && plot.seal > 0.45
        ? "A crosta fechou os poros"
        : share !== null
          ? `${share}% da chuva escorreu`
          : "";
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <h2 className="text-xl text-ink">{title}</h2>
          <p className="text-sm text-muted">{kicker}</p>
        </div>
        {icon}
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="block aspect-video w-full cursor-pointer bg-paper"
          onClick={onToggle}
          aria-hidden="true"
        />
        {!raining && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute top-4 left-1/2 inline-flex min-h-11 -translate-x-1/2 items-center rounded-full border border-line bg-card px-4 text-sm font-medium text-ink"
          >
            Clique no céu para chover
          </button>
        )}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
          <span className="max-w-40 rounded-full bg-card px-3 py-1 text-xs font-medium text-ink sm:text-sm">
            {soil}
          </span>
          <span
            className={
              "max-w-44 rounded-full bg-card px-3 py-1 text-right text-xs font-medium sm:text-sm " +
              (muddy ? "text-clay" : "text-spring")
            }
          >
            {springPhrase(plot)}
          </span>
        </div>
      </div>
      <div className="space-y-3 px-4 py-4">
        <div className="flex items-center gap-3">
          <span
            className={
              "spring-eye relative size-14 shrink-0 overflow-hidden rounded-full border-2 " +
              (muddy ? "border-clay" : "border-spring")
            }
            aria-hidden="true"
          >
            <span className="absolute inset-0 bg-spring" />
            <span className="absolute inset-0 bg-clay" style={{ opacity: 1 - plot.clarity }} />
          </span>
          <p className="text-sm leading-snug text-ink">{use}</p>
        </div>
        <Stat label="Infiltração" value={plot.cumInfil} max={maxInfil} tone={tone} />
        <Stat label="Escoamento" value={plot.cumRunoff} max={maxRun} tone={tone} />
        <Stat label="Sedimentos" value={plot.cumSediment} max={maxSed} tone={tone} />
        <p className="text-sm text-muted">
          Clareza da água {fmt(plot.clarity * 100)}% · vazão {fmt(plot.flowRate * 100)}
          {share !== null ? ` · ${share}% escorreu` : ""}
        </p>
        {note ? <p className="text-sm text-ink">{note}</p> : null}
      </div>
    </article>
  );
}
