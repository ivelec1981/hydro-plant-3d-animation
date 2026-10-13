// Powerhouse: structure with removable front (cutaway), Pelton runner, six injectors on a ring
// distributor, shaft, bearings, salient-pole generator with a removable front sector, governor
// and excitation cabinets. Each piece is built once; cutaways hide pieces of this same model.
import { Geo, mat, K, M4, V3, rgb } from './engine.js';
import { RUN, NOZ, nozzle, PIT, CASE, GEN, HALL, RIVER } from './layout.js';
import { COL, DEG } from './util.js';

const TAU = Math.PI * 2;
export const MAT = {
  conc: mat('#a9a79f', { k: K.concrete, r: 0.88 }), cut: mat('#c9c4b6', { k: K.concrete, r: 0.9 }), concD: mat('#8c8a83', { k: K.concrete, r: 0.9 }),
  wall: mat('#d9d5c9', { k: K.concrete, r: 0.85 }), band: mat('#1F4E79', { r: 0.6 }), roof: mat('#6c7379', { r: 0.6 }), glass: mat('#223040', { k: K.glass, r: 0.1 }),
  floor: mat('#b9b7ae', { k: K.concrete, r: 0.7 }),
  pipe: mat('#5f8f8a', { r: 0.42, m: 0.25 }), pipeIn: mat('#3d5957', { r: 0.6, m: 0.2 }), flange: mat('#49706c', { r: 0.45, m: 0.3 }),
  steel: mat('#b9bec4', { m: 1, r: 0.34 }), dark: mat('#5a6168', { m: 0.8, r: 0.45 }), runner: mat('#cfc6ae', { m: 1, r: 0.27 }),
  casing: mat('#6f8597', { r: 0.42, m: 0.3 }), casingCut: mat('#9fb2c2', { r: 0.6 }),
  frame: mat('#2e6aa3', { r: 0.4, m: 0.2 }), frameCut: mat('#7fa6c9', { r: 0.6 }),
  core: mat('#6d7278', { m: 0.6, r: 0.5 }), coreCut: mat('#9aa0a6', { m: 0.3, r: 0.6 }), pole: mat('#8e959c', { m: 0.8, r: 0.42 }),
  copper: mat('#c8743a', { m: 1, r: 0.36 }), brass: mat('#c9a646', { m: 1, r: 0.3 }), rim: mat('#3d4650', { m: 0.6, r: 0.5 }),
  cab: mat('#dfe3e7', { r: 0.5 }), cabD: mat('#3a4551', { r: 0.5 }), water: mat('#2f7fa3', { k: K.water }), jet: mat('#c9e8ff', { e: 0.3, r: 0.2 }),
  needle: mat('#d9dde2', { m: 1, r: 0.2 }), servo: mat('#d08a2a', { r: 0.4, m: 0.3 }),
};
const ov = (hex) => mat(hex, { k: K.overlay });
const P3 = (r, a, y) => [r * Math.cos(a), y, r * Math.sin(a)];

// slab between a circular hole of radius r (centre at the origin) and a rectangle, over angles a0..a1
function holeSlab(g, r, box, a0, a1, y0, y1, M, Mwall = M) {
  const [x0, z0, x1, z1] = box, as = [];
  for (let i = 0; i <= 48; i++) as.push(a0 + ((a1 - a0) * i) / 48);
  for (const [cx, cz] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) { let a = Math.atan2(cz, cx); while (a < a0 - 1e-9) a += TAU; if (a > a0 + 1e-6 && a < a1 - 1e-6) as.push(a); }
  as.sort((p, q) => p - q);
  const out = (a) => {
    const c = Math.cos(a), s = Math.sin(a); let t = 1e9;
    if (c > 1e-9) t = Math.min(t, x1 / c); if (c < -1e-9) t = Math.min(t, x0 / c);
    if (s > 1e-9) t = Math.min(t, z1 / s); if (s < -1e-9) t = Math.min(t, z0 / s);
    return [c * t, s * t];
  };
  for (let i = 0; i < as.length - 1; i++) {
    const p = as[i], q = as[i + 1], A = out(p), B = out(q), a = [r * Math.cos(p), r * Math.sin(p)], b = [r * Math.cos(q), r * Math.sin(q)];
    g.quad([a[0], y1, a[1]], [A[0], y1, A[1]], [B[0], y1, B[1]], [b[0], y1, b[1]], M);
    g.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [B[0], y0, B[1]], [A[0], y0, A[1]], M);
    const np = [-Math.cos(p), 0, -Math.sin(p)], nq = [-Math.cos(q), 0, -Math.sin(q)];
    g._p([a[0], y0, a[1]], np, Mwall); g._p([b[0], y1, b[1]], nq, Mwall); g._p([b[0], y0, b[1]], nq, Mwall);
    g._p([a[0], y0, a[1]], np, Mwall); g._p([a[0], y1, a[1]], np, Mwall); g._p([b[0], y1, b[1]], nq, Mwall);
  }
}
// arc arrow in a horizontal plane (overlay), pointing towards a1
export function arcArrow(g, c, r, a0, a1, tube, M, n = 40) {
  const pts = [], dir = Math.sign(a1 - a0), head = (tube * 5.5) / r;
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0 - dir * head) * i) / n; pts.push([c[0] + r * Math.cos(a), c[1], c[2] + r * Math.sin(a)]); }
  g.tube(pts, tube, 8, M, true);
  const a = a1 - dir * head;
  g.cone(pts[n], [-Math.sin(a) * dir, 0, Math.cos(a) * dir], tube * 2.6, tube * 5.5, M, 12);
  return g;
}
export function arrow(g, a, b, tube, M) {
  const d = V3.norm(V3.sub(b, a)), L = V3.len(V3.sub(b, a)), h = Math.min(L * 0.5, tube * 5.5), e = V3.add(a, V3.mul(d, L - h));
  g.tube([a, e], tube, 8, M, true); g.cone(e, d, tube * 2.6, h, M, 12);
  return g;
}

export function buildCentral() {
  const G = {}, g = (n) => (G[n] = new Geo());
  const F0 = -0.45;                                  // underside of the machine-hall floor

  // ---------------------------------------------------------------- structure
  let s = g('sub');
  holeSlab(s, PIT.r, [-PIT.half, -PIT.half, PIT.half, 0], Math.PI, TAU, PIT.bottom, F0, MAT.cut, MAT.conc);
  s.blk(-PIT.half, PIT.bottom, 0, -PIT.r, F0, 7.5, MAT.conc); s.blk(PIT.r, PIT.bottom, 0, PIT.half, F0, 7.5, MAT.conc);
  s.blk(-PIT.half, PIT.bottom - 0.6, -PIT.half, PIT.half, PIT.floor, 7.5, MAT.concD);
  s.blk(-4.7, -9.9, 7.5, -PIT.r, -5.6, 10.2, MAT.conc); s.blk(PIT.r, -9.9, 7.5, 4.7, -5.6, 10.2, MAT.conc);        // tailrace wing walls
  s.blk(-PIT.r, -9.9, 7.5, PIT.r, PIT.floor - 0.5, 9.4, MAT.concD);
  for (const a of [200, 250, 290, 340]) { const p = P3(NOZ.ringR, a * DEG, 0); s.cyl(p[0], PIT.floor, p[2], 0.2, RUN.y - 0.4 - PIT.floor, MAT.concD, 10); }

  s = g('subFront');
  s.blk(-PIT.r, -5.5, 6.4, PIT.r, F0, 7.5, MAT.conc);
  holeSlab(s, 0.55, [-PIT.r, 0, PIT.r, 6.4], 0, Math.PI, F0, 0, MAT.floor, MAT.cut);
  s.ring(0, 0, 0.9, 2.75, 0, 0.3, 0, Math.PI, MAT.conc, 48, MAT.cut);                                                  // front half of the generator plinth
  s.blk(-PIT.r, 0, 6.3, PIT.r, 0.04, 6.4, MAT.floor);

  s = g('floor');
  s.blk(HALL.x0, F0, HALL.z0, -PIT.r, 0, HALL.z1, MAT.floor); s.blk(PIT.r, F0, HALL.z0, HALL.x1, 0, HALL.z1, MAT.floor);
  s.blk(-PIT.r, F0, HALL.z0, PIT.r, 0, -PIT.r, MAT.floor);
  holeSlab(s, 0.55, [-PIT.r, -PIT.r, PIT.r, 0], Math.PI, TAU, F0, 0, MAT.floor, MAT.cut);
  s.ring(0, 0, 0.9, 2.75, 0, 0.3, Math.PI, TAU, MAT.conc, 48, MAT.cut);
  // guide bearing under the floor
  s.ring(0, 0, 0.24, 0.6, -1.35, F0, 0, TAU, MAT.casing, 32);

  s = g('hallBack');
  const W = HALL.wall, h = HALL.h;
  s.blk(HALL.x0, 0, HALL.z0, HALL.x1, h, HALL.z0 + W, MAT.wall); s.blk(HALL.x0, 0, HALL.z0 + W, HALL.x0 + W, h, HALL.z1, MAT.wall);
  s.blk(HALL.x0 + W, 0, HALL.z0 + W, HALL.x1, 1.1, HALL.z0 + W + 0.03, MAT.band); s.blk(HALL.x0 + W, 0, HALL.z0 + W, HALL.x0 + W + 0.03, 1.1, HALL.z1, MAT.band);
  for (const x of [-5.4, -1.8, 1.8, 5.4]) s.blk(x - 1.0, 4.4, HALL.z0 + W - 0.02, x + 1.0, 7.9, HALL.z0 + W + 0.05, MAT.glass);
  for (const z of [-4.6, 0.6]) s.blk(HALL.x0 + W - 0.02, 4.4, z - 1.2, HALL.x0 + W + 0.05, 7.9, z + 1.2, MAT.glass);

  s = g('hallFront');
  s.blk(HALL.x0, 0, HALL.z1 - W, HALL.x1, h, HALL.z1, MAT.wall); s.blk(HALL.x1 - W, 0, HALL.z0 + W, HALL.x1, h, HALL.z1 - W, MAT.wall);
  s.blk(HALL.x0 - 0.02, 0, HALL.z1, HALL.x1 + 0.02, 1.1, HALL.z1 + 0.03, MAT.band);
  for (const x of [-5.4, -1.8, 1.8, 5.4]) s.blk(x - 1.0, 4.2, HALL.z1 - 0.05, x + 1.0, 7.9, HALL.z1 + 0.04, MAT.glass);
  s.blk(HALL.x1 - 0.05, 0, -6.2, HALL.x1 + 0.04, 4.2, -3.4, MAT.roof);                                                 // service door
  s.blk(HALL.x0 - 0.5, h, HALL.z0 - 0.5, HALL.x1 + 0.5, h + 0.45, HALL.z1 + 0.3, MAT.roof);
  for (const x of [-5, 0, 5]) s.blk(x - 0.8, h + 0.45, -1.4, x + 0.8, h + 1.0, 1.4, MAT.roof);

  s = g('pitWater');
  const wp = []; for (let i = 0; i <= 24; i++) { const a = Math.PI + (Math.PI * i) / 24; wp.push([(PIT.r - 0.03) * Math.cos(a), (PIT.r - 0.03) * Math.sin(a)]); }
  wp.push([PIT.r - 0.03, 7.5], [-PIT.r + 0.03, 7.5]);
  s.flat(wp, PIT.water, MAT.water);
  s.quad([-PIT.r, PIT.water, 7.5], [-PIT.r, RIVER.y + 0.03, 10.4], [PIT.r, RIVER.y + 0.03, 10.4], [PIT.r, PIT.water, 7.5], MAT.water);

  // ---------------------------------------------------------------- distributor and injectors
  s = g('ring');
  const ringPts = [], ringR = [], A0 = -90 * DEG, A1 = 224 * DEG;
  for (let a = A0; a <= A1 + 1e-6; a += 3 * DEG) { ringPts.push(P3(NOZ.ringR, a, RUN.y)); ringR.push(0.43 - 0.2 * ((a - A0) / (A1 - A0))); }
  s.tube(ringPts, ringR, 18, MAT.pipe, true);
  s.tube([[-PIT.half, RUN.y, -NOZ.ringR], [-1.6, RUN.y, -NOZ.ringR], [-0.6, RUN.y, -NOZ.ringR], [0.05, RUN.y, -NOZ.ringR]], [0.5, 0.5, 0.43, 0.43], 20, MAT.pipe);
  s.tube([[-1.9, RUN.y, -NOZ.ringR], [-1.6, RUN.y, -NOZ.ringR]], 0.6, 20, MAT.flange, true);
  const nozBody = (geo, k) => {
    const n = nozzle(k);
    geo.tube([n.J, n.at(-1.62), n.at(-1.52), n.at(-0.82), n.at(-NOZ.tip)], [0.22, 0.22, 0.26, 0.26, 0.105], 20, MAT.pipe);
    geo.tube([n.at(-1.68), n.at(-1.56)], 0.34, 20, MAT.flange, true);
    // servomotor body on the outer side and jet deflector under the outlet
    const o = V3.add(V3.mul(n.r, 0.42), [0, -0.05, 0]);
    geo.tube([V3.add(n.at(-1.42), o), V3.add(n.at(-0.98), o)], 0.085, 12, MAT.servo, true);
    geo.box(...V3.add(n.at(-1.2), V3.mul(n.r, 0.3)), 0.1, 0.1, 0.16, MAT.dark, -n.phi);
    const d = n.at(-0.2); geo.box(d[0], RUN.y - 0.2, d[2], 0.2, 0.025, 0.26, MAT.dark, -n.phi);
  };
  for (let k = 0; k < NOZ.n; k++) if (k !== NOZ.hero) nozBody(s, k);
  nozBody(g('heroNozzle'), NOZ.hero);
  // needle and servomotor rod, modelled along +x with the origin at the outlet plane
  g('needle').tube([[-1.0, 0, 0], [-0.5, 0, 0], [-0.42, 0, 0], [-0.26, 0, 0], [0.02, 0, 0]], [0.035, 0.035, 0.125, 0.14, 0.002], 18, MAT.needle, true);
  s = g('servoRod'); s.tube([[0, 0, 0], [0.42, 0, 0]], 0.028, 10, MAT.steel, true); s.box(0.42, 0, 0, 0.07, 0.12, 0.12, MAT.dark);
  g('jet').tube([[0, 0, 0], [1, 0, 0]], 1, 16, MAT.jet, true);

  // ---------------------------------------------------------------- turbine casing
  g('caseBack').ring(0, 0, CASE.r0, CASE.r1, CASE.y0, CASE.y1, Math.PI, TAU, MAT.casing, 64, MAT.casingCut);
  s = g('caseFront');
  s.ring(0, 0, CASE.r0, CASE.r1, CASE.y0, CASE.y1, 0, Math.PI, MAT.casing, 64, MAT.casingCut);
  s.ring(0, 0, 0.3, CASE.r1 + 0.05, CASE.y1, CASE.y1 + 0.1, 0, TAU, MAT.casing, 64);

  // ---------------------------------------------------------------- runner (built about the shaft axis, rotates)
  s = g('runner');
  const bucket = new Geo(), rows = 9, cols = 20;
  for (const sg of [-1, 1]) {
    const Pg = [];
    for (let i = 0; i <= rows; i++) {
      const th = 0.04 + ((Math.PI / 2 - 0.04) * i) / rows; Pg.push([]);
      for (let j = 0; j < cols; j++) { const ps = (j / cols) * TAU; Pg[i].push([RUN.a * Math.sin(th) * Math.cos(ps), sg * RUN.b + RUN.b * Math.sin(th) * Math.sin(ps), RUN.c * Math.cos(th)]); }
    }
    bucket.grid(Pg, MAT.runner, true);
  }
  bucket.blk(-RUN.a * 0.96, -0.012, -0.005, RUN.a * 0.96, 0.012, RUN.c * 0.8, MAT.runner);                            // splitter ridge
  bucket.blk(-RUN.a - 0.3, -0.075, 0.01, -RUN.a + 0.05, 0.075, 0.12, MAT.runner);                                      // stem
  for (let k = 0; k < RUN.n; k++) {
    const b = (k / RUN.n) * TAU, c = Math.cos(b), sn = Math.sin(b);
    s.add(bucket, new Float32Array([c, 0, sn, 0, 0, 1, 0, 0, -sn, 0, c, 0, RUN.R * c, RUN.y, RUN.R * sn, 1]));
  }
  s.ring(0, 0, 0.2, RUN.R - RUN.a - 0.22, RUN.y - 0.085, RUN.y + 0.085, 0, TAU, MAT.runner, 64);
  s.cyl(0, RUN.y - 0.2, 0, 0.36, 0.55, MAT.runner, 32); s.cyl(0, RUN.y - 0.42, 0, 0.05, 0.22, MAT.runner, 24, 0.36);

  s = g('shaft');
  s.cyl(0, RUN.y + 0.3, 0, GEN.shaftR, GEN.top - 0.35 - (RUN.y + 0.3), MAT.steel, 28);
  s.cyl(0, -2.35, 0, 0.36, 0.14, MAT.steel, 28); s.cyl(0, -2.2, 0, 0.36, 0.14, MAT.dark, 28);                          // coupling flanges
  for (let i = 0; i < 10; i++) { const p = P3(0.29, (i / 10) * TAU, 0); s.cyl(p[0], -2.42, p[2], 0.03, 0.43, MAT.steel, 6); }

  // ---------------------------------------------------------------- generator
  const yc = GEN.yc, hh = GEN.rotorH / 2;
  s = g('rotor');
  s.ring(0, 0, 0.95, GEN.rimR, yc - hh * 0.95, yc + hh * 0.95, 0, TAU, MAT.rim, 80);
  s.cyl(0, yc - 0.55, 0, 0.42, 1.1, MAT.dark, 24);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; s.box(0.68 * Math.cos(a), yc, 0.68 * Math.sin(a), 0.6, 1.0, 0.1, MAT.dark, -a); }
  for (let i = 0; i < GEN.poles; i++) {
    const a = (i / GEN.poles) * TAU, c = Math.cos(a), sn = Math.sin(a), rb = (GEN.rimR + GEN.bodyR) / 2;
    s.box(rb * c, yc, rb * sn, GEN.bodyR - GEN.rimR + 0.04, GEN.rotorH, 0.24, MAT.pole, -a);
    s.rbox((rb - 0.01) * c, yc, (rb - 0.01) * sn, 0.24, GEN.rotorH + 0.14, 0.39, 0.05, MAT.copper, -a);
    s.ring(0, 0, GEN.bodyR, GEN.shoeR, yc - hh, yc + hh, a - 0.112, a + 0.112, MAT.pole, 96);
  }
  s.cyl(0, 3.72, 0, 0.3, 0.12, MAT.brass, 28); s.cyl(0, 3.98, 0, 0.3, 0.12, MAT.brass, 28);                            // slip rings

  const [c0, c1] = GEN.cut, sect = { Back: [c1, c0 + TAU], Front: [c0, c1] };
  const PH = [mat(COL.L1, { m: 0.6, r: 0.4 }), mat(COL.L2, { m: 0.6, r: 0.4 }), mat(COL.L3, { m: 0.6, r: 0.4 })];
  for (const side of ['Back', 'Front']) {
    const [a0, a1] = sect[side];
    s = g('stator' + side);
    s.ring(0, 0, GEN.boreR, GEN.coreR, GEN.core[0], GEN.core[1], a0, a1, MAT.core, 96, MAT.coreCut);
    for (const y of [GEN.core[0] - 0.2, GEN.core[1] + 0.2]) { const pts = []; for (let i = 0; i <= 60; i++) pts.push(P3(2.0, a0 + 0.02 + ((a1 - a0 - 0.04) * i) / 60, y)); s.tube(pts, 0.14, 10, MAT.copper, true); }
    s = g('frame' + side);
    s.ring(0, 0, GEN.frameR - 0.08, GEN.frameR, GEN.frame[0], GEN.frame[1], a0, a1, MAT.frame, 96, MAT.frameCut);
    s.ring(0, 0, 0.62, GEN.frameR, GEN.frame[1], GEN.frame[1] + 0.13, a0, a1, MAT.frame, 96, MAT.frameCut);
    s.ring(0, 0, GEN.coreR, GEN.frameR - 0.08, GEN.core[0] - 0.08, GEN.core[0], a0, a1, MAT.frame, 96, MAT.frameCut);      // core seat
    s.ring(0, 0, GEN.coreR, GEN.frameR - 0.08, GEN.core[1], GEN.core[1] + 0.08, a0, a1, MAT.frame, 96, MAT.frameCut);
    s.ring(0, 0, 0.66, 0.74, GEN.frame[1] + 0.13, GEN.top - 0.1, a0, a1, MAT.frame, 64, MAT.frameCut);                   // slip-ring housing
    s.ring(0, 0, 0, 0.74, GEN.top - 0.1, GEN.top, a0, a1, MAT.frame, 64, MAT.frameCut);
    for (let a = Math.ceil(a0 / (30 * DEG)) * 30 * DEG; a < a1; a += 30 * DEG) s.box(...P3(GEN.frameR + 0.05, a, (GEN.frame[0] + GEN.frame[1]) / 2), 0.12, GEN.frame[1] - GEN.frame[0], 0.14, MAT.frame, -a);
    // stator bars at the bore, one colour per phase (three slots per pole)
    for (let ph = 0; ph < 3; ph++) {
      s = g('bars' + ph + side);
      for (let i = 0; i < 60; i++) {
        const a = ((i + 0.5) / 60) * TAU, aa = a < a0 - 1e-6 ? a + TAU : a;
        if (i % 3 !== ph || aa < a0 + 0.03 || aa > a1 - 0.03) continue;
        s.ring(0, 0, GEN.boreR - 0.012, GEN.boreR + 0.07, GEN.core[0] - 0.13, GEN.core[1] + 0.13, aa - 0.03, aa + 0.03, PH[ph], 96);
      }
    }
  }
  s = g('genBase');
  s.ring(0, 0, 0.9, GEN.frameR + 0.02, 0.3, GEN.frame[0], 0, TAU, MAT.frame, 96);
  s.ring(0, 0, 0.24, 0.62, GEN.frame[1], GEN.frame[1] + 0.3, 0, TAU, MAT.casing, 32);                                    // thrust bearing

  // ---------------------------------------------------------------- control cabinets
  s = g('govCab');
  s.rbox(6.3, 1.0, 2.7, 1.5, 2.0, 1.0, 0.04, MAT.cab); s.blk(5.56, 1.5, 3.2, 7.04, 1.62, 3.22, mat(COL.mec, { r: 0.5 }));
  s.blk(5.8, 0.9, 3.2, 6.8, 1.35, 3.215, MAT.cabD); s.cyl(7.6, 0, 2.7, 0.42, 1.25, MAT.servo, 18);
  s = g('avrCab');
  s.rbox(-6.5, 1.05, -4.7, 1.8, 2.1, 0.9, 0.04, MAT.cab); s.blk(-7.38, 1.55, -4.25, -5.62, 1.67, -4.235, mat(COL.campo, { r: 0.5 }));
  s.blk(-7.1, 0.9, -4.25, -5.9, 1.4, -4.24, MAT.cabD);
  const hero = nozzle(NOZ.hero), sv = V3.add(V3.add(hero.at(-1.2), V3.mul(hero.r, 0.42)), [0, 0.05, 0]);
  const govPath = [[5.9, 0.3, 2.7], [4.05, 0.3, 2.7], [4.05, -3.3, 2.7], [sv[0] + 0.5, -3.3, sv[2] + 0.5], [sv[0], -3.6, sv[2]], sv];
  const avrPath = [[-6.5, 2.1, -4.7], [-6.5, 5.3, -4.7], [-0.3, 5.3, -0.4], [0, 5.3, 0], [0, GEN.top, 0]];
  g('govLine').tube(govPath, 0.035, 8, MAT.cabD);
  g('avrLine').tube(avrPath, 0.04, 8, MAT.cabD);

  // ---------------------------------------------------------------- conceptual overlays
  s = g('flux');                                                                // rotates with the rotor
  for (let i = 0; i < GEN.poles; i++) for (const dy of [-0.45, 0, 0.45]) {
    const a = (i / GEN.poles) * TAU, b = ((i + 1) / GEN.poles) * TAU, pts = [], y = yc + dy, ro = 2.03, ri = 1.34;
    pts.push(P3(ri, a, y), P3(GEN.shoeR, a, y), P3(ro - 0.08, a + 0.01, y));
    for (let j = 1; j < 8; j++) pts.push(P3(ro, a + ((b - a) * j) / 8, y));
    pts.push(P3(ro - 0.08, b - 0.01, y), P3(GEN.shoeR, b, y), P3(ri, b, y));
    for (let j = 1; j < 6; j++) pts.push(P3(ri - 0.06, b - ((b - a) * j) / 6, y));
    pts.push(P3(ri, a, y));
    s.tube(pts, 0.016, 6, ov(COL.campo));
  }
  arcArrow(g('torqueMec'), [0, -1.9, 0], 0.62, 110 * DEG, 400 * DEG, 0.045, ov(COL.mec));
  arcArrow(g('torqueElec'), [0, GEN.top + 0.45, 0], 1.25, 400 * DEG, 110 * DEG, 0.05, ov(COL.elec));
  // jet path arrows at the hero bucket: incoming jet and the two deflected halves
  s = g('jetArrows');
  const n = hero, up = [0, 1, 0];
  arrow(s, V3.add(n.at(-0.42), [0, 0.2, 0]), V3.add(n.at(-0.02), [0, 0.2, 0]), 0.018, ov('#ffffff'));
  for (const sg of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const u = (i / 14) * 2.9, rr = 0.2; pts.push(V3.add(n.at(0.1 + rr * Math.sin(u) * 0.75), V3.add(V3.mul(up, sg * (0.12 + rr * (1 - Math.cos(u)) * 1.1)), V3.mul(n.r, 0.1)))); }
    s.tube(pts.slice(0, 13), 0.016, 6, ov(COL.agua), true);
    s.cone(pts[12], V3.norm(V3.sub(pts[14], pts[12])), 0.045, 0.1, ov(COL.agua), 10);
  }
  return { G, govPath, avrPath };
}
