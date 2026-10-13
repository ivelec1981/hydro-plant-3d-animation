// World: builds every mesh once and, for a given time, returns the draw lists.
// frame(t, cam) depends only on t: cutaways, rotations, flows and droplets are closed-form.
import { Geo, M4, V3, mat, K } from './engine.js';
import { RUN, NOZ, nozzle, PIT, GEN, X } from './layout.js';
import { buildTerrain, buildWater, buildWorks, buildTrees, penstockPath, PEN } from './terreno.js';
import { buildCentral } from './central.js';
import { buildRed } from './red.js';
import { COL, env, ss, clamp, lerp, rnd, serie, DEG } from './util.js';

const TAU = Math.PI * 2, OV = (hex) => mat(hex, { k: K.overlay });
export const OMEGA = 0.75;                     // visual shaft speed, rad/s (slowed down; the real speed is 360 rpm)

export function createWorld(R, T, D) {
  const S = T.S, W = T.W;
  const cen = buildCentral(), red = buildRed(), wat = buildWater();
  const geos = { terrain: buildTerrain(), lake: wat.lake, river: wat.river, works: buildWorks(), trees: buildTrees(), ...cen.G, ...red.G };
  const mesh = {}; for (const k in geos) mesh[k] = R.mesh(geos[k]);
  const dynPath = R.mesh(new Geo(), true), dynFlow = R.mesh(new Geo(), true), dynDrops = R.mesh(new Geo(), true), dynMmf = R.mesh(new Geo(), true);
  const hero = nozzle(NOZ.hero), noz = Array.from({ length: NOZ.n }, (_, k) => nozzle(k));
  const pitch = TAU / RUN.n;

  // ---------------------------------------------------------------- named instants of the picture
  const fin0 = S[9] + 18.3;
  Object.assign(T, {
    close: W(5, 2, 'cierre') + 0.25, fin0, trafoX: W(5, 3, 'transformador') + 0.5,
    path0: S[1] + 6.9, path1: S[1] + 13.3,
  });
  const st = (t) => ({
    cut: Math.max(env(t, S[3] + 0.4, S[6] + 2.0, 1.6, 1.6), env(t, S[7] - 0.2, S[9] + 0.2, 0.22, 0.22), env(t, fin0, 999, 1.6, 1)),
    casing: Math.max(env(t, S[3] + 1.5, S[6] + 1.2, 1.2, 0.9), env(t, S[7] - 0.2, S[9] + 0.2, 0.22, 0.22), env(t, fin0 + 0.4, 999, 1.4, 1)),
    gen: Math.max(env(t, S[4] + 1.6, S[5] + 2.4, 2.0, 2.0), env(t, S[8] - 0.2, S[9] + 0.2, 0.22, 0.22), env(t, fin0 + 0.6, 999, 1.6, 1)),
    trafo: Math.max(env(t, T.trafoX, S[6] + 1.5, 1.4, 1.2), env(t, fin0 + 0.8, 999, 1.6, 1)),
    clip: Math.max(env(t, S[3] + 2.3, S[4] + 0.6, 1.2, 0.5), env(t, S[7] - 0.2, S[8] + 0.2, 0.22, 0.22)),
    flux: Math.max(env(t, W(4, 2, 'campo') - 0.2, S[5] - 0.6, 0.8, 0.8), env(t, S[8] + 0.3, S[9] - 0.3, 0.6, 0.4)),
    emf: Math.max(env(t, W(4, 3, 'ese'), S[5] + 1.5, 0.6, 1), env(t, S[8] + 0.3, S[9] - 0.3, 0.6, 0.4)),
    water: env(t, S[2] + 11.5, S[3] + 2.4, 1, 1),
    elec: Math.max(env(t, T.close, S[7] - 0.3, 0.8, 0.3), env(t, fin0 + 1.5, 999, 1, 1)),
    path: Math.max(env(t, T.path0, S[2] + 1.6, 0.3, 1.2), env(t, S[9] + 0.2, fin0 + 0.6, 0.5, 1)),
    gov: env(t, T.f.ev + 0.2, T.f.c, 0.5, 1), avr: env(t, T.v.ev, S[9] - 0.4, 0.4, 0.5),
    torqueM: Math.max(env(t, W(3, 3, 'produce'), S[4] + 0.8, 0.5, 0.6), env(t, T.close + 1.0, T.trafoX - 0.3, 0.5, 0.5)),
    torqueE: env(t, T.close + 1.6, T.trafoX - 0.3, 0.5, 0.5),
    arrows: env(t, W(3, 2, 'golpea'), W(3, 3, 'esa') + 0.4, 0.5, 0.5),
  });
  // hydraulic state: design flow, except during the frequency test
  const inTest7 = (t) => t >= S[7] && t < S[8];
  const flow = (t) => (inTest7(t) ? serie(D.frecuencia.Q, D.frecuencia.dt, T.tph7(t)) / D.derivados.caudal_30MW_m3_s : 1);
  const gate = (t) => (inTest7(t) ? serie(D.frecuencia.aguja, D.frecuencia.dt, T.tph7(t)) : 1);
  const g0 = D.frecuencia.aguja[0];
  // needle position along the jet axis: 0.19 = closed, retracts 0.30 m at full opening (motion x3 in the test)
  const needleShift = (t) => 0.19 - 0.3 * (inTest7(t) ? clamp(g0 + 3 * (gate(t) - g0), 0, 1) : 1);
  const theta = (t) => OMEGA * t;
  const jetEnd = (k, th) => { const d = ((((th - noz[k].phi + 0.8 * pitch) % pitch) + pitch) % pitch) - 0.8 * pitch; return RUN.R * Math.tan(d) - 0.015; };

  // ---------------------------------------------------------------- highlights (soft glow while a concept is introduced)
  const HL = [
    [['heroNozzle', 'needle'], COL.agua, S[3] + 2.1, W(3, 1, 'chorro') + 0.6],
    [['runner'], COL.mec, W(3, 3, 'produce'), W(3, 3, 'rodete') + 1.4],
    [['shaft'], COL.mec, W(3, 4, 'eje'), W(3, 4, 'generador') + 0.6],
    [['rotor'], COL.mec, W(4, 1, 'rotor') - 0.2, W(4, 1, 'turbina') + 1.0],
    [['rotor'], COL.campo, W(4, 2, 'electroimanes'), W(4, 2, 'magnetico') + 0.8],
    [['statorBack', 'bars0Back', 'bars1Back', 'bars2Back'], COL.elec, W(4, 2, 'estator') - 0.2, W(4, 2, 'fijo') + 0.9],
    [['gcb'], COL.elec, W(5, 2, 'cierre') - 0.6, W(5, 2, 'cierre') + 2.2],
    [['trafo', 'trafoIn'], COL.elec, W(5, 3, 'transformador'), W(5, 3, 'eleva') + 1.2],
    [['switchgear'], COL.elec, W(6, 4, 'equipos'), W(6, 4, 'proteccion') + 1.4],
    [['distTrafo'], COL.elec, W(6, 3, 'transformador'), W(6, 3, 'distribucion') + 1.2],
    [['govCab', 'govLine'], COL.mec, W(7, 4, 'gobernador') - 0.2, W(7, 4, 'agua') + 1.2],
    [['heroNozzle', 'needle', 'servoRod'], COL.agua, W(7, 4, 'admision'), W(7, 4, 'potencia') + 0.8],
    [['avrCab', 'avrLine'], COL.campo, W(8, 2, 'regulador') - 0.2, W(8, 2, 'tension') + 1.2],
    [['rotor'], COL.campo, W(8, 3, 'excitacion') - 0.2, W(8, 3, 'rotor') + 1.2],
    [['govCab'], COL.mec, W(8, 5, 'gobernador') - 0.2, W(8, 5, 'gobernador') + 1.4],
    [['avrCab'], COL.campo, W(8, 5, 'excitacion') - 0.2, W(8, 5, 'excitacion') + 1.4],
  ].map(([names, hex, t0, t1]) => ({ names, c: mat(hex).c, t0, t1 }));
  const glowOf = (name, t) => { for (const h of HL) if (t > h.t0 && t < h.t1 && h.names.includes(name)) { const a = env(t, h.t0, h.t1, 0.35, 0.5) * (0.3 + 0.1 * Math.sin((t - h.t0) * 5)); return [h.c[0], h.c[1], h.c[2], a]; } return null; };

  // ---------------------------------------------------------------- paths of the conceptual markers
  const pen = penstockPath();
  const master = [];                                                             // [point, domain] from the lake to a house
  const push = (pts, dom) => { for (const p of pts) master.push([p, dom]); };
  push([[-106.4, 58, PEN.z], ...pen, [0, RUN.y, -NOZ.ringR], [0, RUN.y, 0]], 0);
  push([[0, RUN.y, 0], [0, GEN.yc, 0]], 1);
  push([[0, GEN.yc, 0], ...red.paths.bus[1], ...red.paths.hv[1], ...red.paths.st[1], ...red.paths.mv[2].slice(0, -8 * (X.polesMV.length - 1 - X.poleTr)), ...red.paths.prim.slice(1), ...red.paths.drop], 2);
  const cumOf = (pts) => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + V3.len(V3.sub(pts[i], pts[i - 1]))); return c; };
  const mPts = master.map((m) => m[0]), mCum = cumOf(mPts), mLen = mCum[mCum.length - 1];
  const at = (pts, cum, s) => { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const u = clamp((s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), 0, 1); return V3.mix(pts[i - 1], pts[i], u); };
  const FL = (pts, o) => ({ pts, cum: cumOf(pts), ...o });
  const flows = {
    water: [FL(pen, { len: 2.4, gap: 3.6, v: 11, c: COL.agua, px: 3.2, lift: [0, 0.62, 0] })],
    bus: red.paths.bus.map((p, i) => FL(p, { len: 0.34, gap: 0.5, v: 1.7, c: COL.elec, px: 2.6, ph: i * 0.33, lift: [0, 0.16, 0] })),
    hv: red.paths.hv.map((p, i) => FL(p, { len: 2.6, gap: 4.4, v: 15, c: COL.elec, px: 2.4, ph: i * 0.33, min: 0.085 })),
    st: red.paths.st.map((p, i) => FL(p, { len: 1.6, gap: 2.6, v: 9, c: COL.elec, px: 2.2, ph: i * 0.33, min: 0.07 })),
    mv: red.paths.mv.map((p, i) => FL(p, { len: 1.0, gap: 1.7, v: 5.5, c: COL.elec, px: 2.0, ph: i * 0.33, min: 0.058 })),
    lv: [FL(red.paths.prim, { len: 0.3, gap: 0.45, v: 1.6, c: COL.elec, px: 2.0, min: 0.06 }), FL(red.paths.drop, { len: 0.4, gap: 0.6, v: 2.2, c: COL.elec, px: 2.0, min: 0.075 })],
    gov: [FL(cen.govPath, { len: 0.22, gap: 0.3, v: 1.4, c: COL.mec, px: 2.4, min: 0.045 })],
    avr: [FL(cen.avrPath, { len: 0.26, gap: 0.34, v: 1.6, c: COL.campo, px: 2.4, min: 0.055 })],
  };
  const MC = {}; const mc = (hex) => (MC[hex] ||= OV(hex));

  // ---------------------------------------------------------------- static draw table
  const STATIC = ['terrain', 'lake', 'river', 'works', 'trees', 'sub', 'floor', 'hallBack', 'pitWater', 'ring', 'caseBack', 'genBase', 'statorBack', 'frameBack',
    'govCab', 'avrCab', 'govLine', 'avrLine', 'bus', 'gcb', 'trafo', 'trafoIn', 'yard', 'switchgear', 'lines', 'town', 'distTrafo'];
  const GROUP = { subFront: 'cut', hallFront: 'cut', caseFront: 'casing', statorFront: 'gen', frameFront: 'gen', trafoFront: 'trafo' };
  const genDir = [Math.cos(70 * DEG), 0, Math.sin(70 * DEG)];

  // over (optional, used by stand-alone clips): {s: state that replaces st(t), mmf: {te, w: [a, b, c], ws}}.
  // mmf.te is the electrical angle of the stator currents; w weighs the glow of each phase's bars and
  // ws the travelling fundamental wave of the stator, drawn where the front sector has been removed.
  function frame(t, cam, ppm, over = null) {
    const s = over ? over.s : st(t), th = theta(t), opaque = [], blend = [], q = flow(t), rot = M4.rotY(th);
    const wpp = (p) => (V3.len(V3.sub(p, cam.eye)) * 2 * Math.tan((11 * Math.PI) / 180)) / 1080;      // metres per layout pixel at p
    const put = (name, o = {}) => { const g = over ? null : glowOf(name, t); (o.tint && o.tint[3] < 0.999 ? blend : opaque).push({ mesh: mesh[name], glow: g, ...o }); };
    for (const n of STATIC) put(n, n === 'lake' || n === 'river' || n === 'pitWater' || n === 'terrain' ? { noShadow: true } : {});
    for (const n in GROUP) {
      const a = 1 - s[GROUP[n]]; if (a < 0.004) continue;
      const k = 1 - a, model = GROUP[n] === 'gen' ? M4.trans(genDir[0] * k * 0.7, 0, genDir[2] * k * 0.7) : GROUP[n] === 'casing' ? M4.trans(0, k * 0.5, k * 0.5) : null;
      put(n, { model, tint: [1, 1, 1, a], depthWrite: true });
    }
    // phase colours of the stator bars follow the slowed-down induced voltage (10 electrical turns per shaft turn)
    for (let ph = 0; ph < 3; ph++) {
      const e = Math.sin((GEN.poles / 2) * th - (ph * TAU) / 3);
      const b = over && over.mmf ? lerp(0.5, 0.25 + 1.45 * Math.abs(Math.cos(over.mmf.te - ([0, 2, 1][ph] * TAU) / 3)), over.mmf.w[ph]) : lerp(1, 0.35 + 1.25 * Math.abs(e), s.emf);     // in the clip, the three slot groups carry phases A, C, B
      put('bars' + ph + 'Back', { tint: [b, b, b, 1] });
      const a = 1 - s.gen; if (a > 0.004) put('bars' + ph + 'Front', { tint: [b, b, b, a], depthWrite: true, model: M4.trans(genDir[0] * s.gen * 0.7, 0, genDir[2] * s.gen * 0.7) });
    }
    put('runner', { model: rot }); put('shaft', { model: rot }); put('rotor', { model: rot });
    // hero injector: a horizontal cut plane sweeps down to the axis and reveals the needle
    const clip = s.clip > 0.004 ? [0, 1, 0, RUN.y + 0.005 + (1 - s.clip) * 0.45] : null, sh = needleShift(t);
    put('heroNozzle', { clip });
    put('needle', { model: M4.along(hero.at(-NOZ.tip + sh), hero.t) });
    put('servoRod', { model: M4.along(V3.add(V3.add(hero.at(-0.98 + sh), V3.mul(hero.r, 0.42)), [0, -0.05, 0]), hero.t) });
    const rj = 0.083 * Math.sqrt(q);
    for (let k = 0; k < NOZ.n; k++) { const e = jetEnd(k, th); opaque.push({ mesh: mesh.jet, model: M4.along(noz[k].tip, noz[k].t, e + NOZ.tip, rj), noShadow: true }); }

    // ---- conceptual overlays
    if (s.flux > 0.004) {
      const k = !over && t >= S[8] ? serie(D.tension.If, D.tension.dt, T.tph8(t)) / D.tension.If[0] : 1;
      blend.push({ mesh: mesh.flux, model: rot, tint: [k, k, k, s.flux * clamp(0.62 * k, 0, 1)] });
    }
    if (over && over.mmf && over.mmf.ws > 0.004) {
      // fundamental wave of the stator field: F = cos(pairs * angle - te); it travels with the rotor poles
      const gm = new Geo(), [a0, a1] = GEN.cut, da = 1.5 * DEG, r0 = GEN.boreR + 0.035, Mp = mc('#dcc8ff'), Mn = mc('#8558ee');
      for (let a = a0 + 0.03; a < a1 - 0.03; a += da) {
        const F = Math.cos((GEN.poles / 2) * (a + da / 2) - over.mmf.te + Math.PI / 3), len = 0.5 * Math.abs(F);      // axis of phase A is 90 electrical degrees from its bars
        if (len > 0.02) gm.ring(0, 0, r0, r0 + len, GEN.yc - 0.34, GEN.yc + 0.34, a, a + da * 0.82, F > 0 ? Mp : Mn, 48);
      }
      R.update(dynMmf, gm);
      blend.push({ mesh: dynMmf, tint: [1, 1, 1, 0.92 * over.mmf.ws], depthWrite: true });
    }
    if (s.torqueM > 0.004) blend.push({ mesh: mesh.torqueMec, model: M4.rotY(t * 0.5), tint: [1, 1, 1, s.torqueM] });
    if (s.torqueE > 0.004) blend.push({ mesh: mesh.torqueElec, tint: [1, 1, 1, s.torqueE] });
    if (s.arrows > 0.004) blend.push({ mesh: mesh.jetArrows, tint: [1, 1, 1, s.arrows], noDepth: true });

    // energy path of scenes 1 and 9: drawn once from the lake to a house, with travelling pulses
    const gp = new Geo();
    if (s.path > 0.004) {
      const u = t < S[2] + 2 ? ss(T.path0, T.path1, t) : 1, sEnd = u * mLen, cols = [mc(COL.agua), mc(COL.mec), mc(COL.elec)];
      let run = [], dom = master[0][1];
      const flush = () => { if (run.length > 1) gp.tube(run, run.map((p) => 2.3 * wpp(p)), 6, cols[dom], true); };
      for (let i = 0; i < mPts.length && mCum[i] <= sEnd; i++) {
        if (master[i][1] !== dom) { flush(); run = [run[run.length - 1]]; dom = master[i][1]; }
        run.push(mPts[i]);
      }
      if (u < 1) run.push(at(mPts, mCum, sEnd));
      flush();
      for (let k = 0; k < 7; k++) {
        const sp = ((t * 55 + (k * mLen) / 7) % mLen);
        if (sp > sEnd) continue;
        const p = at(mPts, mCum, sp); gp.sphere(p[0], p[1], p[2], 5 * wpp(p), 5 * wpp(p), 5 * wpp(p), mc('#ffffff'), 5);
      }
      if (u < 1) { const p = at(mPts, mCum, sEnd); gp.sphere(p[0], p[1], p[2], 6.5 * wpp(p), 6.5 * wpp(p), 6.5 * wpp(p), mc('#ffffff'), 6); }
    }
    R.update(dynPath, gp);
    if (gp.v.length) blend.push({ mesh: dynPath, tint: [1, 1, 1, s.path], noDepth: true });

    // moving dashes: water in the penstock, current in the conductors, control signals
    const gf = new Geo();
    const dashes = (f, a, speedK = 1) => {
      if (a < 0.02) return;
      const per = f.len + f.gap, L = f.cum[f.cum.length - 1], off = (((t * f.v * speedK) / per + (f.ph || 0)) % 1) * per;
      for (let s0 = off - per; s0 < L; s0 += per) {
        const a0 = Math.max(0, s0), a1 = Math.min(L, s0 + f.len); if (a1 - a0 < f.len * 0.25) continue;
        let p = at(f.pts, f.cum, a0), r = at(f.pts, f.cum, a1);
        if (f.lift) { p = V3.add(p, f.lift); r = V3.add(r, f.lift); }
        const rad = Math.max(f.min || 0.012, f.px * wpp(p)) * Math.sqrt(a);
        gf.tube([p, r], rad, 5, mc(f.c), true);
      }
    };
    for (const f of flows.water) dashes(f, s.water);
    const closed = t >= T.close;
    if (s.elec > 0.02) for (const k of ['bus', 'hv', 'st', 'mv', 'lv']) for (const f of flows[k]) dashes(f, s.elec);
    for (const f of flows.gov) dashes(f, s.gov);
    if (s.avr > 0.02) { const k = clamp(serie(D.tension.If, D.tension.dt, T.tph8(t)) / D.tension.If[0], 0.5, 3); for (const f of flows.avr) dashes(f, s.avr, k); }
    R.update(dynFlow, gf);
    if (gf.v.length) blend.push({ mesh: dynFlow, tint: [1, 1, 1, 0.95] });

    // droplets leaving the buckets (only when the pit is in view)
    const gd = new Geo();
    if (s.cut > 0.3 && ppm > 20) {
      const fw = V3.norm(V3.sub([cam.tx, cam.ty, cam.tz], cam.eye)), rt = V3.norm(V3.cross(fw, [0, 1, 0])), up = V3.cross(rt, fw), Md = mc('#e4f3ff'), life = 0.95, Np = 44;
      for (let k = 0; k < NOZ.n; k++) for (let i = 0; i < Np; i++) {
        const u = (((t / life + i / Np + rnd(i, k)) % 1) + 1) % 1, age = u * life, n = noz[k], p0 = n.at(jetEnd(k, theta(t - age)) + 0.02), sg = i % 2 ? 1 : -1;
        const v = V3.add(V3.add(V3.mul(n.t, 0.3 + 1.1 * rnd(i, 7)), [0, sg * (1.3 + 1.5 * rnd(i, 8)), 0]), V3.mul(n.r, 0.25 + 0.8 * rnd(i, 9)));
        const p = [p0[0] + v[0] * age, p0[1] + v[1] * age - 3.6 * age * age, p0[2] + v[2] * age];
        if (p[1] < PIT.water + 0.05) continue;
        const sz = (0.014 + 0.016 * rnd(i, 4)) * (1 - 0.4 * u) * Math.sqrt(q), a = V3.mul(rt, sz), b = V3.mul(up, sz * (1.3 + 1.4 * age));
        const o = [[1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7], [-1, 0], [-0.7, -0.7], [0, -1], [0.7, -0.7]].map(([x, y]) => V3.add(p, V3.add(V3.mul(a, x), V3.mul(b, y))));
        for (let j = 0; j < 8; j++) gd.tri(p, o[j], o[(j + 1) % 8], Md);
      }
    }
    R.update(dynDrops, gd);
    if (gd.v.length) blend.push({ mesh: dynDrops, tint: [1, 1, 1, 0.8 * ss(0.3, 0.9, s.cut)] });

    const scene = { vp: cam.vp, eye: cam.eye, lightVP: cam.lightVP, bias: cam.bias, fog: cam.fog, time: t, opaque, blend,
      fill: [...V3.norm([0.3, 0.55, 0.78]), 0.85 * Math.max(s.cut, s.trafo * 0.6)] };
    return { scene, info: { s, q, gate: gate(t), closed, theta: th } };
  }
  return { frame, T, anchors: red.anchors, hero, state: st, theta };
}
