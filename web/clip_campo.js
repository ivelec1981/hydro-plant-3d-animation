// Stand-alone insert: "the stator stays still; its field rotates" (about 25 s, English).
// Rendered with ?clip=campo. It reuses the master model (generator cutaway, connected and under
// load) and adds: glow of the stator bars with their phase current, the travelling fundamental wave
// of the stator field in the opened sector, and a panel with the three phase currents and the
// equivalent one-pole-pair picture: each phase contribution pulses on its fixed axis; their sum is
// a vector of constant length that rotates. The sum is checked numerically in sim/campo_trifasico.py.
import { FPS, COL, ss, env, clamp, DEG } from './util.js';
import { GEN } from './layout.js';

const f2 = (x) => x.toFixed(2), TAU = Math.PI * 2;
const P3 = (r, a, y) => [r * Math.cos(a), y, r * Math.sin(a)];

export function createClipCampo(root, lines, voz, world, renderer) {
  const esc = voz.escenas[0], F = esc.frases, DUR = esc.fin, frames = Math.round(DUR * FPS);
  const t1 = F[0].ini, t2 = F[1].ini, t3 = F[2].ini, t4 = F[3].ini;
  const el = (cls, html, css = '') => { const e = document.createElement('div'); e.className = cls; e.innerHTML = html; e.style.cssText = css; e.style.opacity = 0; root.appendChild(e); return e; };
  const PH = [COL.L1, COL.L3, COL.L2], NM = ['A', 'B', 'C'];       // colours of the bar groups that carry each phase in the model
  const tag = el('', 'Motion and waves slowed down for explanation'); tag.id = 'tagR';
  const card = el('card', `<h3>Stator field under load</h3>
    <div class="ct">Phase currents over time</div><svg id="cur" width="810" height="130" viewBox="0 0 810 130"></svg>
    <div class="ct" style="margin-top:10px">Equivalent picture of one pole pair</div><svg id="vec" width="810" height="372" viewBox="0 0 810 372"></svg>
    <p class="dim sm">Ideal balanced case, fundamental only. This machine has 10 pole pairs: 10 electrical cycles per turn.</p>`, 'left:1030px;top:92px;width:846px;');
  const big = el('lbl big', 'The stator does not rotate; its field does', 'left:64px;top:836px;'); big.style.borderLeftColor = COL.campo;
  const labs = [
    { e: el('lbl', 'Stator windings<small>Fixed copper, three phases</small>'), a: P3(GEN.boreR + 0.03, GEN.cut[1] + 0.2, 2.45), t0: t1 + 0.1, t1: t2 + 1.0, dx: -420, dy: -230, col: COL.elec },
    { e: el('lbl', 'Resultant stator field<small>Conceptual representation</small>'), a: P3(GEN.boreR + 0.4, 62 * DEG, GEN.yc + 0.34), t0: t3 + 0.9, t1: DUR + 1, dx: -470, dy: 250, col: COL.campo },
  ];
  for (const l of labs) l.e.style.borderLeftColor = l.col;
  const cam = { tx: 0.25, ty: 1.95, tz: 0.15, az: 22, el: 27, ppm: 118, ox: -430, oy: -30 };
  const $ = (id) => document.getElementById(id);
  let measured = false;

  function render(f) {
    f = Math.max(0, Math.min(frames - 1, Math.round(f)));
    const t = f / FPS, tt = 1000 + t, th = world.theta(tt), te = (GEN.poles / 2) * th - 2.0;        // electrical angle of the currents
    if (!measured) { for (const l of labs) { l.w = l.e.offsetWidth; l.h = l.e.offsetHeight; } measured = true; }
    const wI = ss(t1 + 1.3, t1 + 2.0, t), wP = [ss(t2 - 0.1, t2 + 0.5, t), ss(t2 + 1.5, t2 + 2.1, t), ss(t2 + 3.0, t2 + 3.6, t)], wS = ss(t3 - 0.1, t3 + 0.8, t), wR = ss(t4 - 0.2, t4 + 0.7, t);
    const camera = { ...renderer.camera(cam), ...cam };
    const over = { s: { cut: 1, casing: 1, gen: 1, trafo: 0, clip: 0, flux: 0.5 * wR, emf: 0, water: 0, elec: 1, path: 0, gov: 0, avr: 0, torqueM: 0, torqueE: 0, arrows: 0 },
      mmf: { te, w: [wI, wI, wI], ws: wS } };
    const { scene } = world.frame(tt, camera, cam.ppm, over);
    renderer.render(scene);

    // ---- graphic layer
    const fade = env(t, 0.3, DUR - 0.2, 0.5, 0.4);
    tag.style.opacity = f2(ss(0.3, 0.8, t)); card.style.opacity = f2(ss(t1 + 0.9, t1 + 1.5, t));
    big.style.opacity = f2(ss(t3 + 1.6, t3 + 2.2, t));
    const i = [0, 1, 2].map((k) => Math.cos(te - (k * TAU) / 3));
    // currents: three small plots sharing the time axis; the dot is the present instant
    let s = '';
    for (let k = 0; k < 3; k++) {
      const x0 = 52 + k * 268, w = 204, mid = 66, amp = 46; let d = '';
      for (let q = 0; q <= 60; q++) { const x = x0 + (q / 60) * w, y = mid - amp * Math.cos(te - (k * TAU) / 3 - ((w * 0.7 - (x - x0)) / w) * 3.2 * Math.PI); d += (q ? 'L' : 'M') + f2(x) + ' ' + f2(y); }
      s += `<g opacity="${f2(wI)}"><rect x="${x0}" y="10" width="${w}" height="112" fill="rgba(160,200,235,.05)" stroke="rgba(160,200,235,.25)"/><line x1="${x0}" x2="${x0 + w}" y1="${mid}" y2="${mid}" stroke="rgba(160,200,235,.3)"/>
        <path d="${d}" fill="none" stroke="${PH[k]}" stroke-width="4"/><line x1="${x0 + w * 0.7}" x2="${x0 + w * 0.7}" y1="14" y2="118" stroke="#f3f6f9" stroke-width="2" opacity=".6"/><circle cx="${x0 + w * 0.7}" cy="${f2(mid - amp * i[k])}" r="8" fill="${PH[k]}"/>
        <text x="${x0 - 8}" y="76" text-anchor="end" class="axb" style="fill:${PH[k]}">i${NM[k]}</text></g>`;
    }
    $('cur').innerHTML = s;
    // one pole pair: three fixed axes; each contribution changes length along its axis; the sum rotates
    const cx = 196, cy = 186, R = 96;
    const arrow = (x, y, col, wd, op) => { const L = Math.hypot(x, y); if (L < 4 || op < 0.02) return ''; const ux = x / L, uy = y / L, hx = cx + x, hy = cy + y, b = Math.min(18, L * 0.6);
      return `<g opacity="${f2(op)}"><line x1="${cx}" y1="${cy}" x2="${f2(hx - ux * b * 0.8)}" y2="${f2(hy - uy * b * 0.8)}" stroke="${col}" stroke-width="${wd}" stroke-linecap="round"/><path d="M${f2(hx)} ${f2(hy)}L${f2(hx - ux * b - uy * b * 0.5)} ${f2(hy - uy * b + ux * b * 0.5)}L${f2(hx - ux * b + uy * b * 0.5)} ${f2(hy - uy * b - ux * b * 0.5)}Z" fill="${col}"/></g>`; };
    s = `<circle cx="${cx}" cy="${cy}" r="${R * 1.72}" fill="rgba(160,200,235,.04)" stroke="rgba(160,200,235,.3)" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="${R * 1.5}" fill="none" stroke="${COL.campo}" stroke-dasharray="5 8" opacity="${f2(0.6 * wS)}"/>`;
    let sx = 0, sy = 0;
    for (let k = 0; k < 3; k++) {
      const a = (k * TAU) / 3, ux = Math.cos(a), uy = Math.sin(a);
      s += `<g opacity="${f2(Math.max(0.35 * wI, wP[k]))}"><line x1="${f2(cx - ux * R * 1.7)}" y1="${f2(cy - uy * R * 1.7)}" x2="${f2(cx + ux * R * 1.7)}" y2="${f2(cy + uy * R * 1.7)}" stroke="${PH[k]}" stroke-width="2" stroke-dasharray="6 7" opacity=".7"/>
        <text x="${f2(cx + ux * R * 1.95 - 10)}" y="${f2(cy + uy * R * 1.95 + 12)}" class="axb" style="fill:${PH[k]}">${NM[k]}</text></g>`;
      s += arrow(ux * R * i[k], uy * R * i[k], PH[k], 7, wP[k]);
      sx += ux * R * i[k]; sy += uy * R * i[k];
    }
    s += arrow(sx, sy, COL.campo, 10, wS);
    const row = (y, col, a, b, op) => `<g opacity="${f2(op)}"><rect x="424" y="${y - 22}" width="34" height="8" rx="4" fill="${col}"/><text x="470" y="${y - 8}" class="axb">${a}</text><text x="470" y="${y + 24}" class="ax">${b}</text></g>`;
    s += row(96, '#f3f6f9', 'Each phase', 'pulses on a fixed axis', Math.max(...wP)) + row(196, COL.campo, 'Their sum', 'rotates, constant length', wS)
      + `<text x="424" y="300" class="ax" opacity="${f2(Math.max(...wP))}">Arrows show fields in space,</text><text x="424" y="332" class="ax" opacity="${f2(Math.max(...wP))}">not current phasors</text>`;
    $('vec').innerHTML = s;
    // labels with leader lines
    let svg = ''; const project = (p) => renderer.project(camera.vp, p);
    for (const l of labs) {
      const a = env(t, l.t0, l.t1, 0.35, 0.35); l.e.style.opacity = f2(a); if (a < 0.004) continue;
      const p = project(l.a), bx = clamp(p[0] + l.dx, 36, 980 - l.w), by = clamp(p[1] + l.dy - l.h / 2, 36, 800 - l.h);
      const ex = clamp(p[0], bx, bx + l.w), ax = Math.abs(p[0] - ex) < 1 ? p[0] : ex, ay = Math.abs(p[0] - ex) < 1 ? clamp(p[1], by, by + l.h) : by + l.h / 2;
      l.e.style.left = f2(bx) + 'px'; l.e.style.top = f2(by) + 'px';
      svg += `<line x1="${f2(p[0])}" y1="${f2(p[1])}" x2="${f2(ax)}" y2="${f2(ay)}" opacity="${f2(a * 0.9)}"/><circle class="dot" cx="${f2(p[0])}" cy="${f2(p[1])}" r="5" opacity="${f2(a)}"/>`;
    }
    lines.innerHTML = svg;
    return { f, t, scene: 'campo', labels: 3 };
  }
  return { frames, render, DUR };
}
