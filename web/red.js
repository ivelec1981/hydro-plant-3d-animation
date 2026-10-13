// Electrical chain outside the generator: isolated-phase bus, generator circuit breaker, step-up
// transformer (with removable front panel), 230 kV bay and line, 230/69 kV substation, 69 kV
// subtransmission, 69/13.8 kV substation, medium-voltage feeder, pole-mounted single-phase
// distribution transformer (7.97 kV phase-to-neutral / 120-240 V with grounded centre tap) and
// consumers. Also returns the conductor paths used for the conceptual current markers.
import { Geo, mat, K, V3 } from './engine.js';
import { X, ZL, GEN, span, H } from './layout.js';
import { rnd, DEG } from './util.js';

const M = {
  tank: mat('#8d989f', { r: 0.5, m: 0.2 }), tankD: mat('#6f7a81', { r: 0.55, m: 0.2 }), core: mat('#6d7278', { m: 0.6, r: 0.5 }),
  lv: mat('#d2823f', { m: 1, r: 0.33 }), hv: mat('#9a4b2b', { m: 0.8, r: 0.42 }), porc: mat('#7b4a33', { r: 0.25 }), poly: mat('#9aa3aa', { r: 0.4 }),
  alu: mat('#d5d8da', { m: 1, r: 0.4 }), bus: mat('#c3c8cc', { m: 0.7, r: 0.45 }), galv: mat('#a9b0b5', { m: 0.6, r: 0.5 }),
  cab: mat('#dfe3e7', { r: 0.5 }), cabD: mat('#3a4551', { r: 0.5 }), conc: mat('#a9a79f', { k: K.concrete, r: 0.88 }), gravel: mat('#b3ada0', { k: K.concrete, r: 0.95 }),
  pole: mat('#b5b2a8', { k: K.concrete, r: 0.8 }), wood: mat('#6b4f37', { r: 0.9 }), asphalt: mat('#494c50', { k: K.concrete, r: 0.9 }), walk: mat('#b9b6ac', { k: K.concrete, r: 0.9 }),
  glass: mat('#223040', { k: K.glass, r: 0.1 }), wire: mat('#2a2d31', { r: 0.6 }), roofs: ['#a8563d', '#8f4a37', '#7a6a5a', '#9c6046'].map((c) => mat(c, { r: 0.8 })),
  walls: ['#e6dccb', '#d9cdb8', '#e9e4da', '#cfd6d8', '#e3d2bd'].map((c) => mat(c, { k: K.concrete, r: 0.85 })),
  blocks: ['#c9ccd0', '#b8bfc6', '#d6d0c4', '#aeb7bf', '#c2b9ad'].map((c) => mat(c, { k: K.concrete, r: 0.7 })),
};

// stack of sheds between y0 and y1; returns the top point
function bushing(g, x, y0, z, y1, r, Mi = M.porc, n = 0) {
  n = n || Math.max(4, Math.round((y1 - y0) / (r * 0.9)));
  const pts = [], rr = [];
  for (let i = 0; i <= n * 2; i++) { pts.push([x, y0 + ((y1 - y0) * i) / (n * 2), z]); rr.push(i % 2 ? r : r * 0.55); }
  g.tube(pts, rr, 12, Mi, true);
  g.cyl(x, y1, z, r * 0.42, r * 0.5, M.alu, 10);
  return [x, y1 + r * 0.5, z];
}
// three-phase transformer. dir = +1: high-voltage bushings on the +x side
function transformer(body, front, inner, x0, z0, s, dir, zHV, zLV) {
  const T = (x, y, z) => [x0 + dir * x * s, y * s, z0 + z * s], B = (g, a, b, Mt) => { const p = T(...a), q = T(...b); g.blk(Math.min(p[0], q[0]), p[1], p[2], Math.max(p[0], q[0]), q[1], q[2], Mt); };
  B(body, [-1.9, 0, -1.3], [1.9, 0.3, 1.3], M.conc); B(body, [-1.8, 0.3, -1.2], [1.8, 0.5, 1.2], M.tankD);
  B(body, [-1.8, 0.5, -1.2], [1.8, 0.58, 1.2], M.tank); B(body, [-1.8, 3.02, -1.2], [1.8, 3.1, 1.2], M.tank);
  B(body, [-1.8, 0.5, -1.2], [1.8, 3.1, -1.12], M.tank); B(body, [-1.8, 0.5, -1.2], [-1.72, 3.1, 1.2], M.tank); B(body, [1.72, 0.5, -1.2], [1.8, 3.1, 1.2], M.tank);
  B(front || body, [-1.8, 0.5, 1.12], [1.8, 3.1, 1.2], M.tank);
  for (const x of [-1.2, 0, 1.2]) B(front || body, [x - 0.04, 0.5, 1.2], [x + 0.04, 3.1, 1.26], M.tankD);                   // stiffeners
  for (let i = 0; i < 11; i++) B(body, [-1.7 + i * 0.34 - 0.035, 0.8, -2.0], [-1.7 + i * 0.34 + 0.035, 2.9, -1.28], M.tankD);     // radiators
  B(body, [-1.75, 2.75, -2.0], [1.75, 2.9, -1.2], M.tankD); B(body, [-1.75, 0.8, -2.0], [1.75, 0.95, -1.2], M.tankD);
  body.tube([T(-1.3, 3.95, -0.85), T(1.0, 3.95, -0.85)], 0.36 * s, 16, M.tank, true);                                       // conservator
  B(body, [-0.9, 3.1, -0.9], [-0.8, 3.7, -0.8], M.tankD); B(body, [0.6, 3.1, -0.9], [0.7, 3.7, -0.8], M.tankD);
  // core and windings
  const I = inner || body;
  for (const x of [-1.1, 0, 1.1]) {
    B(I, [x - 0.2, 0.75, -0.2], [x + 0.2, 2.7, 0.2], M.core);
    const p = T(x, 0, 0);
    I.cyl(p[0], 0.98 * s, p[2], 0.33 * s, 1.5 * s, M.lv, 24); I.cyl(p[0], 1.07 * s, p[2], 0.47 * s, 1.32 * s, M.hv, 24);
  }
  B(I, [-1.4, 0.62, -0.2], [1.4, 0.98, 0.2], M.core); B(I, [-1.4, 2.48, -0.2], [1.4, 2.84, 0.2], M.core);
  const hv = zHV.map((z) => bushing(body, x0 + dir * 0.95 * s, 3.1 * s, z0 + z * s, 5.25 * s, 0.2 * s));
  const lv = zLV.map((z) => bushing(body, x0 - dir * 1.3 * s, 3.1 * s, z0 + z * s, 3.72 * s, 0.14 * s));
  return { hv, lv };
}
// apparatus on a steel stand with an insulator column; returns the terminal on top
function column(g, x, z, top, r = 0.2, head = 0) {
  g.blk(x - 0.14, 0, z - 0.14, x + 0.14, 1.3, z + 0.14, M.galv); g.blk(x - 0.3, 0, z - 0.3, x + 0.3, 0.12, z + 0.3, M.conc);
  const p = bushing(g, x, 1.3, z, top - r * 0.5 - head, r, M.poly);
  if (head) g.cyl(x, top - head - 0.02, z, r * 1.5, head, M.galv, 14);
  return [x, top, z];
}
function gantry(g, x, hgt, half, zs) {
  for (const z of [-half, half]) {
    for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [0.35, 0.35], [-0.35, 0.35]]) g.tube([[x + dx, 0, z + dz], [x + dx * 0.6, hgt, z + dz * 0.6]], 0.06, 4, M.galv);
    for (let y = 0; y < hgt - 0.5; y += 1.6) { g.tube([[x - 0.35, y, z - 0.35], [x + 0.33, y + 1.6, z - 0.33]], 0.035, 4, M.galv); g.tube([[x + 0.35, y, z + 0.35], [x - 0.33, y + 1.6, z + 0.33]], 0.035, 4, M.galv); g.tube([[x - 0.35, y, z + 0.35], [x - 0.33, y + 1.6, z - 0.33]], 0.035, 4, M.galv); g.tube([[x + 0.35, y, z - 0.35], [x + 0.33, y + 1.6, z + 0.33]], 0.035, 4, M.galv); }
    g.blk(x - 0.6, 0, z - 0.6, x + 0.6, 0.2, z + 0.6, M.conc);
  }
  g.blk(x - 0.28, hgt - 0.55, -half - 0.4, x + 0.28, hgt, half + 0.4, M.galv);
  return zs.map((z) => { bushing(g, x, hgt - 1.75, z, hgt - 0.6, 0.13, M.poly, 5); return [x, hgt - 1.8, z]; });
}
function tower(g, x) {
  const leg = (sx, sz) => [[x + sx * 3.1, 0, sz * 3.1], [x + sx * 0.85, 19.5, sz * 0.85], [x + sx * 0.55, 29.2, sz * 0.55]];
  const L = [leg(-1, -1), leg(1, -1), leg(1, 1), leg(-1, 1)];
  for (const l of L) { g.tube(l, 0.1, 4, M.galv); g.blk(l[0][0] - 0.5, -0.2, l[0][2] - 0.5, l[0][0] + 0.5, 0.25, l[0][2] + 0.5, M.conc); }
  const at = (l, y) => { const [a, b, c] = l; return y <= 19.5 ? V3.mix(a, b, y / 19.5) : V3.mix(b, c, (y - 19.5) / 9.7); };
  const ys = [0, 4.5, 8.5, 12, 15, 17.5, 19.5, 22, 24.5, 27, 29.2];
  for (let k = 0; k < ys.length - 1; k++) for (let f = 0; f < 4; f++) {
    const a = L[f], b = L[(f + 1) % 4];
    g.tube([at(a, ys[k]), at(b, ys[k + 1])], 0.05, 4, M.galv); g.tube([at(b, ys[k]), at(a, ys[k + 1])], 0.05, 4, M.galv);
    g.tube([at(a, ys[k + 1]), at(b, ys[k + 1])], 0.05, 4, M.galv);
  }
  const arm = (y, z) => { const sz = Math.sign(z); for (const sx of [-1, 1]) { g.tube([[x + sx * 0.8, y, sz * 0.8], [x, y, z]], 0.07, 4, M.galv); g.tube([[x + sx * 0.7, y + 2.3, sz * 0.7], [x, y + 0.1, z]], 0.06, 4, M.galv); } bushing(g, x, y - 2.3, z, y - 0.1, 0.13, M.poly, 7); return [x, y - 2.35, z]; };
  g.tube([[x, 29.2, 0], [x, 30.4, 0]], 0.06, 4, M.galv);
  return { ph: [arm(20.8, -7.5), arm(25.6, 4.2), arm(20.8, 7.5)], top: [x, 30.4, 0] };
}
function pole(g, x, z, hgt, r = 0.24, Mp = M.pole) { g.cyl(x, -0.3, z, r, hgt + 0.3, Mp, 10, r * 0.6); }
function house(g, x, z, i) {
  const w = 7.4 + 2 * rnd(i, 1), d = 6.4, h = 3.1 + 0.5 * rnd(i, 2), Mw = M.walls[i % 5], Mr = M.roofs[i % 4], e = 0.5, rh = 1.9;
  g.blk(x - w / 2, 0, z - d / 2, x + w / 2, h, z + d / 2, Mw);
  const a = [x - w / 2 - e, h, z + d / 2 + e], b = [x + w / 2 + e, h, z + d / 2 + e], c = [x + w / 2 + e, h, z - d / 2 - e], dd = [x - w / 2 - e, h, z - d / 2 - e], r0 = [x - w / 2 - e, h + rh, z], r1 = [x + w / 2 + e, h + rh, z];
  g.quad(a, b, r1, r0, Mr); g.quad(c, dd, r0, r1, Mr);
  g.tri([x - w / 2, h, z + d / 2], [x - w / 2, h, z - d / 2], [x - w / 2, h + rh * 0.9, z], Mw); g.tri([x + w / 2, h, z - d / 2], [x + w / 2, h, z + d / 2], [x + w / 2, h + rh * 0.9, z], Mw);
  g.blk(x - 0.5, 0, z + d / 2, x + 0.5, 2.1, z + d / 2 + 0.05, M.wood);
  for (const dx of [-w * 0.3, w * 0.3]) g.blk(x + dx - 0.7, 1.1, z + d / 2, x + dx + 0.7, 2.3, z + d / 2 + 0.05, M.glass);
  return { eave: [x + w * 0.42, h - 0.1, z + d / 2 + 0.1] };
}

export function buildRed() {
  const G = {}, g = (n) => (G[n] = new Geo()), paths = {};
  const zb = [-0.55, 0, 0.55], zHV = [-2.4, 0, 2.4];

  // ---------------------------------------------------------------- generator leads, breaker, step-up transformer
  let s = g('trafo'); const tf = transformer(s, g('trafoFront'), g('trafoIn'), X.trafo, 0, 1, 1, [-0.85, 0, 0.85], zb);
  s = g('bus'); paths.bus = [];
  zb.forEach((dz, i) => {
    const a = (-22 + i * 9 - 9) * DEG, p = [[GEN.frameR * Math.cos(a), 1.55, GEN.frameR * Math.sin(a)], [4.3, 1.55, GEN.frameR * Math.sin(a) - 0.2], [5.6, 1.55, dz], [X.gcb - 1.2, 1.55, dz], [X.gcb + 1.2, 1.55, dz], [X.trafo - 2.6, 1.55, dz], [tf.lv[i][0], 2.6, dz], tf.lv[i]];
    s.tube(p.slice(0, 4), 0.13, 12, M.bus); s.tube(p.slice(4), 0.13, 12, M.bus, true);
    paths.bus.push(p);
  });
  s.blk(8.55, 0.9, -1.2, 9.05, 2.2, 1.2, M.cabD);                                                                         // wall penetration
  s = g('gcb');
  s.rbox(X.gcb, 1.25, 0, 2.3, 2.5, 2.7, 0.05, M.cab); s.blk(X.gcb - 0.8, 0.5, 1.35, X.gcb + 0.8, 2.1, 1.37, M.cabD); s.blk(X.gcb - 1.3, 0, -1.5, X.gcb + 1.3, 0.12, 1.5, M.conc);

  // ---------------------------------------------------------------- 230 kV bay, line and towers
  s = g('yard'); const sw = g('switchgear'), line = g('lines'); paths.hv = []; paths.shield = [];
  s.rect(21, -11, 41, 11, 0.03, M.gravel);
  const gan = gantry(s, X.gantry, 12.6, 8, [-5, 0, 5]), tw = X.towers.map((x) => tower(s, x));
  s.rect(X.sub1In - 4, -13, X.sub1Out + 4, 13, 0.03, M.gravel);
  const s1in = gantry(s, X.sub1In, 12.6, 8, [-5, 0, 5]);
  const t1 = transformer(s, null, null, X.sub1Tr, 0, 0.9, -1, [-0.9, 0, 0.9], [-0.6, 0, 0.6]);
  zHV.forEach((z, i) => {
    const b = column(sw, X.hvBrk, z, 5.6, 0.22, 0.5), c = column(sw, X.ct, z, 5.6, 0.2, 0.7), d1 = column(sw, X.dis - 1, z, 5.6, 0.17), d2 = column(sw, X.dis + 1, z, 5.6, 0.17);
    sw.tube([d1, d2], 0.05, 6, M.alu);
    const b1 = column(sw, X.sub1Brk, z, 5.6, 0.22, 0.5);
    const p = [tf.hv[i], [X.trafo + 3, 5.9, z * 0.7], b, c, d1, d2, [X.gantry - 1.2, 8, gan[i][2] * 0.8], gan[i]];
    let q = [...p];
    const pts = [gan[i], ...tw.map((t) => t.ph[i]), s1in[i]];
    for (let k = 0; k < pts.length - 1; k++) q = q.concat(span(pts[k], pts[k + 1], k === 0 || k === pts.length - 2 ? 1.6 : 3.2).slice(1));
    q.push([X.sub1In + 1.5, 8, z * 1.6], b1, [X.sub1Tr - 3, 5.4, t1.hv[i][2]], t1.hv[i]);
    line.tube(q, 0.06, 6, M.alu);
    paths.hv.push(q);
  });
  { const tops = [[X.gantry, 12.6, 8], ...tw.map((t) => t.top), [X.sub1In, 12.6, 8]]; let q = [tops[0]]; for (let k = 0; k < tops.length - 1; k++) q = q.concat(span(tops[k], tops[k + 1], 2.2).slice(1)); line.tube(q, 0.045, 5, M.galv); }

  // ---------------------------------------------------------------- 230/69 kV substation and 69 kV subtransmission
  const z69 = [-1.6, 0, 1.6];
  const s1out = gantry(s, X.sub1Out, 8.6, 5, [-2.6, 0, 2.6]);
  s.blk(X.sub1Tr - 3, 0, -11.5, X.sub1Tr + 3, 3.4, -7.5, M.walls[3]); s.blk(X.sub1Tr - 3.3, 3.4, -11.8, X.sub1Tr + 3.3, 3.7, -7.2, M.cabD);        // control house
  s.blk(X.sub1Tr - 0.6, 0, -7.5, X.sub1Tr + 0.6, 2.2, -7.45, M.cabD);
  const fence = (x0, x1, zz) => { for (let x = x0; x <= x1 + 0.01; x += 3) for (const z of [-zz, zz]) s.blk(x - 0.05, 0, z - 0.05, x + 0.05, 2.2, z + 0.05, M.galv); for (const z of [-zz, zz]) for (const y of [1.1, 2.15]) s.tube([[x0, y, z], [x1, y, z]], 0.03, 4, M.galv); };
  fence(X.sub1In - 3, X.sub1Out + 3, 12.5);
  const p69 = X.poles69.map((x) => { pole(s, x, 0, 13, 0.3); s.blk(x - 0.08, 11.3, -1.9, x + 0.08, 11.5, 1.9, M.galv); return [bushing(s, x, 11.5, -1.6, 12.3, 0.12, M.poly, 4), bushing(s, x, 13, 0, 13.8, 0.12, M.poly, 4), bushing(s, x, 11.5, 1.6, 12.3, 0.12, M.poly, 4)]; });
  s.rect(X.sub2In - 4, -9, X.sub2Sw + 5, 9, 0.03, M.gravel);
  const s2in = gantry(s, X.sub2In, 8.6, 5, [-2.6, 0, 2.6]);
  const t2 = transformer(s, null, null, X.sub2Tr, 0, 0.64, -1, [-0.9, 0, 0.9], [-0.6, 0, 0.6]);
  fence(X.sub2In - 3, X.sub2Sw + 4, 8.5);
  paths.st = [];
  z69.forEach((z, i) => {
    const b2 = column(sw, X.sub1Brk2, z, 4.3, 0.17, 0.4), bq = column(sw, X.sub2In + 3, z, 4.0, 0.15, 0.35);
    let q = [t1.lv[i], [X.sub1Tr + 2.6, 4.0, z], b2, [X.sub1Out - 1, 6, s1out[i][2] * 0.8], s1out[i]];
    const pts = [s1out[i], ...p69.map((p) => p[i]), s2in[i]];
    for (let k = 0; k < pts.length - 1; k++) q = q.concat(span(pts[k], pts[k + 1], 0.9).slice(1));
    q.push(bq, [X.sub2Tr - 1.8, 3.6, t2.hv[i][2]], t2.hv[i]);
    line.tube(q, 0.05, 6, M.alu);
    paths.st.push(q);
  });

  // ---------------------------------------------------------------- 13.8 kV switchgear, feeder, distribution transformer, low voltage
  s.blk(X.sub2Sw - 2.4, 0, -2.4, X.sub2Sw + 2.4, 3.3, 2.4, M.cab); s.blk(X.sub2Sw - 2.6, 3.3, -2.6, X.sub2Sw + 2.6, 3.5, 2.6, M.cabD);
  for (const dx of [-1.5, -0.5, 0.5, 1.5]) s.blk(X.sub2Sw + dx - 0.42, 0.2, 2.4, X.sub2Sw + dx + 0.42, 2.9, 2.43, M.cabD);
  const town = g('town');
  town.rect(274, 6.2, 420, 12.2, 0.04, M.asphalt); town.rect(274, 5.2, 420, 6.2, 0.1, M.walk); town.rect(274, 12.2, 420, 13.2, 0.1, M.walk);
  town.rect(338, -62, 344, 6.2, 0.04, M.asphalt); town.rect(372, -62, 378, 6.2, 0.04, M.asphalt);
  const zm = [ZL - 0.9, ZL, ZL + 0.9];
  const pm = X.polesMV.map((x) => {
    pole(s, x, ZL, 10.5, 0.22); s.blk(x - 0.07, 9.5, ZL - 1.15, x + 0.07, 9.66, ZL + 1.15, M.galv);
    return [bushing(s, x, 9.66, zm[0], 10.15, 0.09, M.poly, 3), bushing(s, x, 10.5, zm[1], 11.0, 0.09, M.poly, 3), bushing(s, x, 9.66, zm[2], 10.15, 0.09, M.poly, 3)];
  });
  paths.mv = [];
  zm.forEach((z, i) => {
    let q = [t2.lv[i], [X.sub2Tr + 1.6, 2.2, t2.lv[i][2]], [X.sub2Sw - 2.4, 2.0, (i - 1) * 0.6], [X.sub2Sw + 2.4, 0.4, (i - 1) * 0.3], [X.sub2Sw + 3.2, 0.12, (i - 1) * 0.3], [X.polesMV[0] - 0.4, 0.12, ZL + (i - 1) * 0.12], [X.polesMV[0] - 0.3, 9.2, ZL + (i - 1) * 0.12], pm[0][i]];
    line.tube(q.slice(0, 3), 0.04, 6, M.alu); line.tube(q.slice(3), 0.04, 6, M.wire);
    for (let k = 0; k < pm.length - 1; k++) { const sp = span(pm[k][i], pm[k + 1][i], 0.35, 8); line.tube(sp, 0.04, 5, M.alu); q = q.concat(sp.slice(1)); }
    paths.mv.push(q);
  });
  { let q = []; for (let k = 0; k < pm.length - 1; k++) q = q.concat(span([X.polesMV[k], 8.2, ZL + 0.26], [X.polesMV[k + 1], 8.2, ZL + 0.26], 0.3, 8)); line.tube(q, 0.035, 5, M.alu); }     // neutral
  // pole-mounted single-phase transformer: one phase and the neutral on the primary
  const xt = X.polesMV[X.poleTr], dt = g('distTrafo'), can = [xt + 0.7, 6.3, ZL];
  dt.cyl(can[0], can[1], can[2], 0.48, 1.15, M.tank, 18); dt.cyl(can[0], can[1] + 1.15, can[2], 0.5, 0.06, M.tankD, 18);
  dt.blk(xt, 6.5, ZL - 0.08, xt + 0.4, 6.62, ZL + 0.08, M.galv); dt.blk(xt, 7.2, ZL - 0.08, xt + 0.4, 7.32, ZL + 0.08, M.galv);
  const hvB = bushing(dt, can[0], can[1] + 1.2, can[2], can[1] + 1.75, 0.09, M.porc, 3);
  dt.blk(xt + 0.3, 8.7, ZL + 0.8, xt + 0.42, 9.2, ZL + 0.92, M.porc);                                                         // fuse cutout
  const prim = [pm[X.poleTr][2], [xt + 0.36, 9.3, ZL + 0.86], [xt + 0.36, 8.7, ZL + 0.86], [can[0], 8.5, ZL + 0.3], hvB];
  line.tube(prim, 0.03, 5, M.wire);
  // low-voltage line (two phases and neutral) and service drops to the houses
  const lvY = [7.25, 7.05, 6.85]; paths.lv = [];
  for (const y of lvY) { let q = []; for (let k = 1; k < 4; k++) q = q.concat(span([X.polesMV[k], y, ZL - 0.2], [X.polesMV[k + 1] ?? X.polesMV[k], y, ZL - 0.2], 0.25, 6)); line.tube(q.slice(0, 14), 0.03, 5, M.wire); }
  line.tube([[can[0] - 0.42, 7.05, ZL - 0.1], [xt, 7.05, ZL - 0.2]], 0.045, 5, M.wire);
  const hs = X.houses.map((x, i) => house(town, x, -6, i));
  const drop = (k, hi) => { const a = [X.polesMV[k], 7.05, ZL - 0.2], b = hs[hi].eave, sp = span(a, b, 0.5, 8); line.tube(sp, 0.04, 5, M.wire); return sp; };
  drop(1, 0); drop(1, 1); const d2 = drop(2, 2); drop(3, 3); drop(3, 4);
  paths.prim = prim; paths.drop = [[can[0], 7.05, ZL], [xt, 7.05, ZL - 0.2], ...d2];
  for (let i = 0; i < 7; i++) house(town, 281 + i * 9.2, -19.5, i + 7);
  // town blocks behind and to the right
  for (let i = 0; i < 34; i++) {
    const bx = 349 + (i % 6) * 9.6 + (i % 6 >= 2 ? 6 : 0), bz = -56 + Math.floor(i / 6) * 10.4, w = 6.6 + 1.6 * rnd(i, 7), d = 7.4, hh = 5 + Math.floor(rnd(i, 8) * rnd(i, 9) * 7) * 3.1, Mb = M.blocks[i % 5];
    if (bx > 371 && bx < 379) continue;
    town.blk(bx - w / 2, 0, bz - d / 2, bx + w / 2, hh, bz + d / 2, Mb); town.blk(bx - w / 2 - 0.15, hh, bz - d / 2 - 0.15, bx + w / 2 + 0.15, hh + 0.35, bz + d / 2 + 0.15, M.cabD);
    for (let y = 1.4; y < hh - 1; y += 3.1) town.blk(bx - w / 2 + 0.4, y, bz + d / 2, bx + w / 2 - 0.4, y + 1.3, bz + d / 2 + 0.04, M.glass);
  }
  return { G, paths, anchors: { tfHV: tf.hv[1], tfLV: tf.lv[1], can, hvB, t1: [X.sub1Tr, 4.6, 0], t2: [X.sub2Tr, 3.2, 0], house: hs[2].eave, tower: tw[1].top } };
}
