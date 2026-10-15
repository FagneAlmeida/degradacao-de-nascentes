import type { PlotModel } from "@/lib/soil-sim";

export const VW = 800;
export const VH = 450;

const SPRING_X = 608;
const BOWL = 84;

export type Drop = { x: number; y: number; vy: number; len: number };
export type Grain = { x: number; y: number; vx: number; r: number; shade: number };
export type Fragment = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  air: boolean;
  verts: number[];
  shade: number;
};
export type Splash = { x: number; y: number; life: number; max: number; dirt: boolean };
export type Mote = { ang: number; rad: number; speed: number; size: number };

export type Visual = {
  drops: Drop[];
  grains: Grain[];
  fragments: Fragment[];
  splashes: Splash[];
  motes: Mote[];
  blades: { x: number; h: number; lean: number; shade: number }[];
  trees: { x: number; h: number; r: number; shade: number }[];
  specks: { x: number; y: number; s: number; a: number }[];
  cracks: { x: number; dy: number }[][];
};

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function baseSurface(x: number) {
  const t = x / VW;
  if (t < 0.64) {
    const u = t / 0.64;
    return 118 + u * 148 + Math.sin(u * Math.PI) * 8;
  }
  const u = (t - 0.64) / 0.36;
  return 266 + u * 16;
}

export function groundY(x: number, integrity: number, tillage: boolean) {
  let y = baseSurface(x);
  const dx = x - SPRING_X;
  if (Math.abs(dx) < BOWL) {
    const n = Math.abs(dx) / BOWL;
    y += Math.cos(n * Math.PI * 0.5) * 36;
  }
  if (integrity < 0.985 && x < SPRING_X - BOWL - 8) {
    const depth = (1 - integrity) * (tillage ? 78 : 58);
    const cuts = tillage ? [0.16, 0.28, 0.4, 0.52] : [0.22, 0.36, 0.5];
    const t = x / VW;
    for (const g of cuts) {
      const d = Math.abs(t - g);
      const w = tillage ? 0.026 : 0.04;
      if (d < w) {
        const k = 1 - d / w;
        y += depth * k * k;
      }
    }
  }
  return y;
}

export function createVisual(kind: PlotModel["kind"]): Visual {
  const rand = mulberry32(kind === "covered" ? 11 : 29);
  const blades: Visual["blades"] = [];
  const trees: Visual["trees"] = [];
  const specks: Visual["specks"] = [];
  const cracks: Visual["cracks"] = [];

  if (kind === "covered") {
    for (let i = 0; i < 90; i++) {
      blades.push({
        x: 16 + rand() * 500,
        h: 10 + rand() * 16,
        lean: -6 + rand() * 10,
        shade: rand(),
      });
    }
    const spots = [58, 150, 250, 345, 455];
    for (const x of spots) {
      trees.push({
        x: x + (rand() - 0.5) * 16,
        h: 92 + rand() * 36,
        r: 28 + rand() * 16,
        shade: rand(),
      });
    }
  } else {
    for (let i = 0; i < 26; i++) {
      blades.push({
        x: 24 + rand() * 480,
        h: 5 + rand() * 7,
        lean: -3 + rand() * 8,
        shade: rand(),
      });
    }
    for (let c = 0; c < 7; c++) {
      const crack: { x: number; dy: number }[] = [];
      let x = 40 + rand() * 430;
      let dy = 0;
      const n = 4 + Math.floor(rand() * 4);
      for (let i = 0; i < n; i++) {
        crack.push({ x, dy });
        x += 10 + rand() * 22;
        dy += rand() * 7;
      }
      cracks.push(crack);
    }
  }

  for (let i = 0; i < 70; i++) {
    specks.push({
      x: rand() * VW,
      y: 140 + rand() * 280,
      s: 1 + rand() * 2.2,
      a: 0.08 + rand() * 0.18,
    });
  }

  const motes: Mote[] = [];
  for (let i = 0; i < 10; i++) {
    motes.push({
      ang: rand() * Math.PI * 2,
      rad: 8 + rand() * 28,
      speed: 0.4 + rand() * 0.8,
      size: 1.2 + rand() * 2.2,
    });
  }

  return {
    drops: [],
    grains: [],
    fragments: [],
    splashes: [],
    motes,
    blades,
    trees,
    specks,
    cracks,
  };
}

function spawnFragment(rand: number, x: number, y: number, covered: boolean): Fragment {
  const n = 4 + ((rand * 3) | 0);
  const size = covered ? 5 + rand * 4 : 12 + rand * 16;
  const verts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand;
    const rad = size * (0.62 + ((i * 37) % 10) / 18);
    verts.push(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  return {
    x,
    y,
    vx: (covered ? 12 : 36) + rand * 30,
    vy: -30 - rand * 70,
    rot: rand * 6,
    vr: (rand - 0.5) * 3.2,
    size,
    air: true,
    verts,
    shade: rand,
  };
}

export function stepVisual(
  visual: Visual,
  plot: PlotModel,
  rain: number,
  tillage: boolean,
  dt: number,
) {
  const covered = plot.kind === "covered";
  const targetDrops = Math.floor(rain * (covered ? 70 : 100));
  while (visual.drops.length < targetDrops) {
    visual.drops.push({
      x: Math.random() * (VW + 40) - 20,
      y: -Math.random() * 160,
      vy: 420 + Math.random() * 260,
      len: 12 + Math.random() * 14,
    });
  }
  if (visual.drops.length > targetDrops) {
    visual.drops.length = targetDrops;
  }

  for (let i = visual.drops.length - 1; i >= 0; i--) {
    const drop = visual.drops[i];
    drop.y += drop.vy * dt;
    drop.x -= 28 * dt;
    if (covered && drop.y > groundY(drop.x, plot.integrity, false) - 78 && Math.random() < 0.35) {
      visual.splashes.push({
        x: drop.x,
        y: drop.y,
        life: 0.22,
        max: 0.22,
        dirt: false,
      });
      visual.drops.splice(i, 1);
      continue;
    }
    const gy = groundY(drop.x, plot.integrity, tillage && !covered);
    if (drop.y >= gy) {
      visual.splashes.push({
        x: drop.x,
        y: gy,
        life: covered ? 0.18 : 0.32,
        max: covered ? 0.18 : 0.32,
        dirt: !covered,
      });
      if (!covered && plot.sedRate > 0.05 && visual.grains.length < 90 && Math.random() < 0.55) {
        visual.grains.push({
          x: drop.x,
          y: gy - 2,
          vx: 40 + Math.random() * 50,
          r: 1.4 + Math.random() * 2.2,
          shade: Math.random(),
        });
      }
      if (plot.sedRate > 0.08 && visual.fragments.length < (covered ? 6 : 36) && Math.random() < (covered ? 0.04 : 0.45)) {
        visual.fragments.push(spawnFragment(Math.random(), drop.x, gy - 6, covered));
      }
      visual.drops.splice(i, 1);
    } else if (drop.y > VH + 20) {
      visual.drops.splice(i, 1);
    }
  }

  const gyOf = (x: number) => groundY(x, plot.integrity, tillage && !covered);

  for (let i = visual.grains.length - 1; i >= 0; i--) {
    const g = visual.grains[i];
    g.x += g.vx * dt;
    g.y = gyOf(g.x) - g.r;
    if (g.x > SPRING_X - 10) visual.grains.splice(i, 1);
  }

  for (let i = visual.fragments.length - 1; i >= 0; i--) {
    const f = visual.fragments[i];
    f.rot += f.vr * dt;
    if (f.air) {
      f.vy += 520 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.y >= gyOf(f.x) - 2) {
        f.air = false;
        f.y = gyOf(f.x) - 2;
        if (covered) f.vx *= 0.25;
      }
    } else {
      f.vx = covered ? Math.max(4, f.vx * 0.98) : 28 + (1 - plot.integrity) * 55;
      f.x += f.vx * dt;
      f.y = gyOf(f.x) - f.size * 0.35;
      if (covered && Math.random() < dt * 0.4) {
        visual.fragments.splice(i, 1);
        continue;
      }
    }
    if (f.x > SPRING_X + BOWL * 0.15 || f.x > VW + 20) {
      visual.splashes.push({
        x: Math.min(f.x, SPRING_X + 10),
        y: gyOf(Math.min(f.x, SPRING_X)),
        life: 0.45,
        max: 0.45,
        dirt: true,
      });
      visual.fragments.splice(i, 1);
    }
  }

  for (let i = visual.splashes.length - 1; i >= 0; i--) {
    visual.splashes[i].life -= dt;
    if (visual.splashes[i].life <= 0) visual.splashes.splice(i, 1);
  }

  for (const m of visual.motes) {
    m.ang += m.speed * dt * (0.4 + plot.flowRate);
  }
}

function mix(a: string, b: string, t: number) {
  const parse = (h: string) => {
    const n = h.replace("#", "");
    return [
      parseInt(n.slice(0, 2), 16),
      parseInt(n.slice(2, 4), 16),
      parseInt(n.slice(4, 6), 16),
    ];
  };
  const A = parse(a);
  const B = parse(b);
  const u = Math.max(0, Math.min(1, t));
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * u));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function traceGround(
  ctx: CanvasRenderingContext2D,
  integrity: number,
  tillage: boolean,
  x0 = 0,
  x1 = VW,
) {
  ctx.beginPath();
  ctx.moveTo(x0, groundY(x0, integrity, tillage));
  for (let x = x0; x <= x1; x += 6) ctx.lineTo(x, groundY(x, integrity, tillage));
  ctx.lineTo(x1, groundY(x1, integrity, tillage));
}

function soilPath(ctx: CanvasRenderingContext2D, integrity: number, tillage: boolean) {
  traceGround(ctx, integrity, tillage);
  ctx.lineTo(VW, VH);
  ctx.lineTo(0, VH);
  ctx.closePath();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTree(
  ctx: CanvasRenderingContext2D,
  tree: Visual["trees"][number],
  integrity: number,
  time: number,
  motion: boolean,
) {
  const gy = groundY(tree.x, integrity, false);
  const sway = motion ? Math.sin(time * 1.2 + tree.x * 0.02) * 3 : 0;
  ctx.strokeStyle = "#5a3a28";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(tree.x, gy);
  ctx.lineTo(tree.x + sway * 0.4, gy - tree.h * 0.72);
  ctx.stroke();

  ctx.save();
  soilPath(ctx, integrity, false);
  ctx.clip();
  ctx.strokeStyle = "rgba(90, 58, 40, 0.55)";
  ctx.lineWidth = 1.6;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(tree.x, gy + 2);
    ctx.bezierCurveTo(
      tree.x + side * 18,
      gy + 18,
      tree.x + side * 36,
      gy + 28,
      tree.x + side * (20 + tree.r),
      gy + 46,
    );
    ctx.stroke();
  }
  ctx.restore();

  const top = gy - tree.h;
  const greens = ["#1d6a42", "#246b3c", "#154f32", "#2f7a4a"];
  const color = greens[Math.floor(tree.shade * greens.length) % greens.length];
  ctx.fillStyle = color;
  const blobs = [
    [0, 0, tree.r],
    [-tree.r * 0.7, tree.r * 0.25, tree.r * 0.75],
    [tree.r * 0.72, tree.r * 0.2, tree.r * 0.7],
    [0, -tree.r * 0.45, tree.r * 0.62],
  ];
  for (const [ox, oy, r] of blobs) {
    ctx.beginPath();
    ctx.arc(tree.x + sway + ox, top + oy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.arc(tree.x + sway - tree.r * 0.2, top - 4, tree.r * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawCow(ctx: CanvasRenderingContext2D, x: number, gy: number) {
  ctx.save();
  ctx.fillStyle = "rgba(36, 28, 20, 0.12)";
  ctx.beginPath();
  ctx.ellipse(x, gy - 1, 30, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3a2a22";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const dx of [-16, -7, 10, 18]) {
    ctx.beginPath();
    ctx.moveTo(x + dx, gy - 16);
    ctx.lineTo(x + dx + 1, gy);
    ctx.stroke();
  }
  ctx.fillStyle = "#6d4c34";
  ctx.beginPath();
  ctx.ellipse(x, gy - 26, 26, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3e2c22";
  ctx.beginPath();
  ctx.ellipse(x - 4, gy - 28, 8, 5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6d4c34";
  ctx.beginPath();
  ctx.ellipse(x + 30, gy - 32, 9, 7.5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d7b89a";
  ctx.beginPath();
  ctx.ellipse(x + 38, gy - 30, 4.5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#241c14";
  ctx.beginPath();
  ctx.arc(x + 34, gy - 34, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.font = "600 13px Outfit, sans-serif";
  const w = ctx.measureText(text).width;
  ctx.fillStyle = "rgba(247, 241, 230, 0.9)";
  roundRect(ctx, x, y - 14, w + 14, 20, 8);
  ctx.fill();
  ctx.fillStyle = "#241c14";
  ctx.fillText(text, x + 7, y);
}

export function drawScene(
  canvas: HTMLCanvasElement,
  plot: PlotModel,
  visual: Visual,
  opts: {
    tillage: boolean;
    cattle: boolean;
    time: number;
    motion: boolean;
    raining: boolean;
  },
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || 800;
  const cssH = canvas.clientHeight || 450;
  const bw = Math.max(1, Math.round(cssW * dpr));
  const bh = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  ctx.setTransform(bw / VW, 0, 0, bh / VH, 0, 0);
  ctx.clearRect(0, 0, VW, VH);

  const covered = plot.kind === "covered";
  const tillage = !covered && opts.tillage;
  const cattle = !covered && opts.cattle;
  const integrity = plot.integrity;

  const sky = ctx.createLinearGradient(0, 0, 0, 200);
  sky.addColorStop(0, "#d5e2e4");
  sky.addColorStop(1, "#f4efe4");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VW, VH);

  ctx.fillStyle = "#ddd4c4";
  ctx.beginPath();
  ctx.moveTo(0, 168);
  ctx.quadraticCurveTo(180, 120, 380, 156);
  ctx.quadraticCurveTo(560, 188, VW, 150);
  ctx.lineTo(VW, 210);
  ctx.lineTo(0, 210);
  ctx.fill();

  const sub = ctx.createLinearGradient(0, 140, 0, VH);
  sub.addColorStop(0, covered ? "#a56b3d" : "#c4844a");
  sub.addColorStop(0.45, covered ? "#8a552f" : "#a86a38");
  sub.addColorStop(1, "#7a736c");
  ctx.fillStyle = sub;
  soilPath(ctx, integrity, tillage);
  ctx.fill();

  ctx.save();
  soilPath(ctx, integrity, tillage);
  ctx.clip();
  const thick = (covered ? 34 : 22) * (0.35 + integrity * 0.65);
  ctx.beginPath();
  ctx.moveTo(0, groundY(0, integrity, tillage));
  for (let x = 0; x <= VW; x += 6) ctx.lineTo(x, groundY(x, integrity, tillage));
  for (let x = VW; x >= 0; x -= 6) ctx.lineTo(x, groundY(x, integrity, tillage) + thick);
  ctx.closePath();
  const dry = covered ? "#3e2a1c" : "#c4a27a";
  const wet = covered ? "#2a1c12" : "#6e4a2c";
  ctx.fillStyle = mix(dry, wet, plot.wetness);
  ctx.fill();

  for (const s of visual.specks) {
    if (s.y < groundY(s.x, integrity, tillage)) continue;
    ctx.fillStyle = `rgba(36, 28, 20, ${s.a})`;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }

  const tableDepth = covered ? 86 - plot.storage * 52 : 112 - plot.storage * 30;
  ctx.beginPath();
  ctx.moveTo(0, baseSurface(0) + tableDepth);
  for (let x = 0; x <= VW; x += 8) ctx.lineTo(x, baseSurface(x) + tableDepth);
  ctx.lineTo(VW, VH);
  ctx.lineTo(0, VH);
  ctx.closePath();
  ctx.fillStyle = covered ? "rgba(26, 115, 128, 0.22)" : "rgba(26, 115, 128, 0.1)";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, baseSurface(0) + tableDepth);
  for (let x = 0; x <= VW; x += 8) ctx.lineTo(x, baseSurface(x) + tableDepth);
  ctx.strokeStyle = "rgba(20, 96, 108, 0.85)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  if (!covered) {
    ctx.save();
    ctx.strokeStyle = `rgba(60, 36, 22, ${0.25 + (1 - integrity) * 0.65})`;
    ctx.lineWidth = 1 + (1 - integrity) * 1.6;
    ctx.lineCap = "round";
    for (const crack of visual.cracks) {
      ctx.beginPath();
      crack.forEach((p, i) => {
        const y = groundY(p.x, integrity, tillage) + p.dy * (0.25 + (1 - integrity));
        if (i === 0) ctx.moveTo(p.x, y);
        else ctx.lineTo(p.x, y);
      });
      ctx.stroke();
    }
    ctx.restore();
  }

  if (tillage) {
    ctx.strokeStyle = "rgba(90, 52, 28, 0.45)";
    ctx.lineWidth = 2;
    for (const g of [0.16, 0.28, 0.4, 0.52]) {
      ctx.beginPath();
      const x0 = g * VW;
      ctx.moveTo(x0, groundY(x0, integrity, true) + 1);
      for (let x = x0; x < SPRING_X - 90; x += 10) {
        ctx.lineTo(x + (g - 0.3) * 20, groundY(x, integrity, true) + 2);
      }
      ctx.stroke();
    }
  }

  if (covered) {
    for (const tree of visual.trees) drawTree(ctx, tree, integrity, opts.time, opts.motion);
    ctx.strokeStyle = "#2f6a40";
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    for (const b of visual.blades) {
      const gy = groundY(b.x, integrity, false);
      const sway = opts.motion ? Math.sin(opts.time * 2 + b.x) * 1.5 : 0;
      ctx.strokeStyle = b.shade > 0.5 ? "#1d6a42" : "#3d8a52";
      ctx.beginPath();
      ctx.moveTo(b.x, gy);
      ctx.quadraticCurveTo(b.x + b.lean * 0.4 + sway, gy - b.h * 0.6, b.x + b.lean + sway, gy - b.h);
      ctx.stroke();
    }
  } else if (!cattle) {
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    for (const b of visual.blades) {
      const gy = groundY(b.x, integrity, tillage);
      ctx.strokeStyle = "#8a7a48";
      ctx.beginPath();
      ctx.moveTo(b.x, gy);
      ctx.quadraticCurveTo(b.x + b.lean, gy - b.h * 0.6, b.x + b.lean, gy - b.h);
      ctx.stroke();
    }
  }

  if (cattle) {
    ctx.strokeStyle = "rgba(60, 40, 24, 0.35)";
    ctx.lineWidth = 1.5;
    for (let x = 70; x < 520; x += 28) {
      const gy = groundY(x, integrity, tillage);
      ctx.beginPath();
      ctx.arc(x, gy - 1, 4, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 7, gy - 1, 3.5, Math.PI, 0);
      ctx.stroke();
    }
    drawCow(ctx, 210, groundY(210, integrity, tillage));
    drawCow(ctx, 390, groundY(390, integrity, tillage));
  }

  if (!covered && plot.runoffRate > 0.1) {
    ctx.beginPath();
    ctx.moveTo(16, groundY(16, integrity, tillage) + 1);
    for (let x = 16; x <= SPRING_X + 24; x += 10) {
      ctx.lineTo(x, groundY(x, integrity, tillage) + 1);
    }
    for (let x = SPRING_X + 24; x >= 16; x -= 10) {
      const sheet = 2 + plot.runoffRate * 9;
      ctx.lineTo(x, groundY(x, integrity, tillage) + sheet);
    }
    ctx.closePath();
    ctx.fillStyle = mix("#cfe3e6", "#6a4528", 1 - plot.clarity * 0.55);
    ctx.globalAlpha = Math.min(0.72, 0.28 + plot.runoffRate * 0.5);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (covered && opts.raining && plot.infilRate > 0.15) {
    ctx.strokeStyle = "rgba(26, 115, 128, 0.55)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 5]);
    for (let i = 0; i < 6; i++) {
      const x = 70 + i * 72;
      const gy = groundY(x, integrity, false);
      const drop = ((opts.time * 28 + i * 18) % 46);
      ctx.beginPath();
      ctx.moveTo(x, gy + 8 + drop);
      ctx.lineTo(x, gy + 22 + drop);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  if (plot.runoffRate > 0.08) {
    const n = Math.round(plot.runoffRate * (tillage ? 7 : 5));
    ctx.lineCap = "round";
    ctx.strokeStyle = mix("#c5dde2", "#7a5a32", covered ? 0.15 : 1 - plot.clarity * 0.3);
    ctx.globalAlpha = Math.min(0.85, 0.35 + plot.runoffRate);
    ctx.lineWidth = covered ? 1.4 : 2.2;
    for (let i = 0; i < n; i++) {
      const start = 30 + ((i * 97) % 480);
      ctx.beginPath();
      ctx.moveTo(start, groundY(start, integrity, tillage) + 1);
      for (let x = start; x < SPRING_X + 20; x += 14) {
        const wobble = Math.sin(x * 0.08 + opts.time * 6 + i) * 1.5;
        ctx.lineTo(x, groundY(x, integrity, tillage) + wobble);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  for (const f of visual.fragments) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.fillStyle = mix("#a86a38", "#4a2e1c", f.shade);
    ctx.beginPath();
    ctx.moveTo(f.verts[0], f.verts[1]);
    for (let i = 2; i < f.verts.length; i += 2) ctx.lineTo(f.verts[i], f.verts[i + 1]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  for (const g of visual.grains) {
    ctx.fillStyle = mix("#c4844a", "#3e2918", g.shade);
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawSpring(ctx, plot, tillage, cattle, opts.time, visual);

  if (opts.raining) {
    ctx.strokeStyle = "rgba(74, 122, 146, 0.55)";
    ctx.lineWidth = 1.35;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const d of visual.drops) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 3.5, d.y - d.len);
    }
    ctx.stroke();
  }

  for (const s of visual.splashes) {
    const k = 1 - s.life / s.max;
    ctx.beginPath();
    ctx.strokeStyle = s.dirt ? `rgba(120, 72, 40, ${0.7 * (1 - k)})` : `rgba(90, 140, 160, ${0.6 * (1 - k)})`;
    ctx.lineWidth = 1.2;
    ctx.arc(s.x, s.y, 2 + k * (s.dirt ? 11 : 6), 0, Math.PI * 2);
    ctx.stroke();
  }

  if (opts.raining && covered && plot.infilRate > 0.2) {
    drawLabel(ctx, "infiltração", 70, 96);
  }
  if (opts.raining && !covered && plot.runoffRate > 0.2) {
    drawLabel(ctx, "escoamento", 300, 150);
  }
  drawLabel(ctx, "lençol", 36, Math.min(baseSurface(40) + (covered ? 86 - plot.storage * 52 : 112 - plot.storage * 30) - 8, 400));
  drawLabel(ctx, "nascente", SPRING_X - 20, baseSurface(SPRING_X) - 8);
}

function drawSpring(
  ctx: CanvasRenderingContext2D,
  plot: PlotModel,
  tillage: boolean,
  cattle: boolean,
  time: number,
  visual: Visual,
) {
  const integrity = plot.integrity;
  const fill = Math.max(0, Math.min(1, plot.storage * 0.82 + plot.pond * 0.75));
  const pts: { x: number; gy: number }[] = [];
  for (let x = SPRING_X - BOWL; x <= SPRING_X + BOWL; x += 4) {
    pts.push({ x, gy: groundY(x, integrity, tillage) });
  }
  let bottom = 0;
  for (const p of pts) bottom = Math.max(bottom, p.gy);
  const lip = Math.min(pts[0].gy, pts[pts.length - 1].gy);
  const capacity = bottom - lip + 8;
  const siltFrac = Math.min(
    0.82,
    plot.cumSediment / (plot.kind === "covered" ? 80 : 16),
  );
  const siltTop = bottom - capacity * siltFrac;
  const waterY = Math.min(bottom - capacity * fill, siltTop - 3);
  const wet = pts.filter((p) => p.gy > waterY + 0.5);
  if (wet.length < 2) return;

  const clear = mix("#d7f6f4", "#1a7380", 0.45 + plot.storage * 0.2);
  let color = mix(clear, "#6a4528", 1 - plot.clarity);
  if (cattle) color = mix(color, "#5c6b32", 0.4);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(wet[0].x, waterY);
  for (const p of wet) ctx.lineTo(p.x, p.gy);
  ctx.lineTo(wet[wet.length - 1].x, waterY);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, waterY, 0, bottom);
  grad.addColorStop(0, mix("#f4fffe", color, 0.35));
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.fill();

  if (plot.clarity > 0.65 && !cattle) {
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(wet[0].x + 10, waterY + 3);
    ctx.quadraticCurveTo(SPRING_X, waterY + 1, wet[wet.length - 1].x - 14, waterY + 4);
    ctx.stroke();
  }

  ctx.clip();
  for (const m of visual.motes) {
    const x = SPRING_X + Math.cos(m.ang + time) * m.rad * 0.7;
    const y = (waterY + bottom) / 2 + Math.sin(m.ang) * 6;
    if (y < waterY) continue;
    ctx.fillStyle =
      plot.clarity > 0.6 && !cattle ? "rgba(255,255,255,0.75)" : "rgba(62, 40, 22, 0.8)";
    ctx.globalAlpha = 0.35 + (1 - plot.clarity) * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, m.size * (plot.clarity > 0.6 ? 0.7 : 1.3), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (siltFrac > 0.04) {
    ctx.fillStyle = plot.kind === "covered" ? "rgba(120, 86, 52, 0.55)" : "#6a4124";
    ctx.beginPath();
    ctx.moveTo(SPRING_X - BOWL * 0.92, siltTop);
    ctx.quadraticCurveTo(SPRING_X, siltTop - 6, SPRING_X + BOWL * 0.92, siltTop + 2);
    ctx.lineTo(SPRING_X + BOWL * 0.55, bottom + 14);
    ctx.lineTo(SPRING_X - BOWL * 0.7, bottom + 14);
    ctx.closePath();
    ctx.fill();

    const rocks = Math.min(7, Math.floor(plot.cumSediment / (plot.kind === "covered" ? 12 : 2.4)));
    for (let i = 0; i < rocks; i++) {
      const x = SPRING_X - 46 + i * 14;
      const y = siltTop + 2 + (i % 3) * 3;
      ctx.fillStyle = i % 2 === 0 ? "#8a5a32" : "#4e321c";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 9, y + 2);
      ctx.lineTo(x + 6, y + 8);
      ctx.lineTo(x - 2, y + 6);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (fill > 0.28 && plot.flowRate > 0.08 && siltFrac < 0.72) {
    const mouth = wet[wet.length - 1];
    const width = 1.6 + plot.flowRate * 8 * (1 - siltFrac * 0.65);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(mouth.x, waterY + 1);
    const endY = groundY(VW - 8, integrity, false) + 2;
    ctx.bezierCurveTo(mouth.x + 50, waterY + 8, 730, endY - 4, VW - 4, endY);
    ctx.stroke();

    ctx.fillStyle = mix("#f4fffe", cattle ? "#5c6b32" : "#6a4528", 1 - plot.clarity);
    const span = VW - mouth.x;
    for (let i = 0; i < 5; i++) {
      const shift = ((time * (30 + plot.flowRate * 80) + i * 40) % span) / span;
      const x = mouth.x + shift * span;
      const y = waterY + (endY - waterY) * shift;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, width * 0.22), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  if (plot.kind === "covered") {
    ctx.strokeStyle = "#1d6a42";
    ctx.lineWidth = 1.3;
    for (const side of [-1, 1]) {
      const x = SPRING_X + side * 58;
      const gy = groundY(x, integrity, false);
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.quadraticCurveTo(x + side * 3, gy - 10, x + side * 6, gy - 16);
      ctx.stroke();
    }
  }
}
