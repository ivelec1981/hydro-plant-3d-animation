// Landscape and hydraulic works outside the powerhouse: terrain, lake, river, dam, intake,
// penstock on its anchor blocks, quay wall and trees. All procedural and deterministic.
import { Geo, mat, K, V3 } from './engine.js';
import { H, groundColor, LAKE, DAM, RIVER, riverZ, PIT, RUN, X } from './layout.js';
import { ss, lerp, rnd, clamp } from './util.js';

export const PEN = { z: -2.9, r: 0.5 };
// centre line of the penstock from the dam to the powerhouse wall
export const penY = (x) => lerp(H(x, PEN.z) + 0.95, RUN.y, ss(-19, -8.5, x));
export function penstockPath() {
  const p = [[DAM.x + 0.6, 50.4, PEN.z]];
  for (let x = -97; x <= -7.0001; x += 1.5) p.push([x, penY(x), PEN.z]);
  p.push([-7, RUN.y, PEN.z]);
  return p;
}

const M = {
  conc: mat('#a9a79f', { k: K.concrete, r: 0.88 }), concD: mat('#8f8d86', { k: K.concrete, r: 0.9 }),
  pipe: mat('#5f8f8a', { r: 0.42, m: 0.25 }), band: mat('#3f5f5c', { r: 0.5, m: 0.3 }),
  lake: mat('#1d5b85', { k: K.water }), river: mat('#2b6d86', { k: K.water }),
  trunk: mat('#4a3a2a', { r: 0.9 }), steel: mat('#8d969c', { m: 0.7, r: 0.45 }), roof: mat('#6c7379', { r: 0.6 }),
};

function axis(lo, hi, stops) {
  // stops: [[from, to, step], ...] sorted; returns the merged coordinate list
  const a = [];
  for (const [f, t, s] of stops) for (let v = f; v < t - 1e-6; v += s) a.push(Math.round(v * 1000) / 1000);
  a.push(hi);
  return [...new Set(a)].sort((p, q) => p - q);
}

export function buildTerrain() {
  const xs = axis(-760, 900, [[-760, -340, 60], [-340, -232, 12], [-232, -32, 4], [-32, 52, 1], [52, 420, 4], [420, 540, 12], [540, 900, 60]]);
  const zs = axis(-760, 620, [[-760, -280, 60], [-280, -92, 12], [-92, -12, 4], [-12, 7, 1], [7, 7.3, 0.3], [7.3, 7.45, 0.15], [7.45, 8, 0.55], [8, 44, 1], [44, 100, 4], [100, 220, 12], [220, 620, 50]]);
  const g = new Geo(), hgt = xs.map((x) => zs.map((z) => H(x, z)));
  // normals from the mesh itself, so shading and rock colour follow the geometry that is drawn
  const N = xs.map((x, i) => zs.map((z, j) => { const i0 = Math.max(0, i - 1), i1 = Math.min(xs.length - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(zs.length - 1, j + 1);
    return V3.norm([-(hgt[i1][j] - hgt[i0][j]) / (xs[i1] - xs[i0]), 1, -(hgt[i][j1] - hgt[i][j0]) / (zs[j1] - zs[j0])]); }));
  const C = xs.map((x, i) => zs.map((z, j) => ({ c: groundColor(x, z, hgt[i][j], 1 - N[i][j][1]), m: 0, r: 0.95, e: 0, k: K.ground })));
  const P = (i, j) => [xs[i], hgt[i][j], zs[j]];
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
    if (Math.abs(cx) < 9 && cz > -8 && cz < 7.45) continue;                         // powerhouse footprint
    for (const [a, b] of [[i, j], [i, j + 1], [i + 1, j + 1], [i, j], [i + 1, j + 1], [i + 1, j]]) g._p(P(a, b), N[a][b], C[a][b]);
  }
  return g;
}

export function buildWater() {
  const lake = new Geo(), river = new Geo();
  const pts = [];
  for (let i = 0; i < 64; i++) { const a = (i / 64) * 6.283185; pts.push([Math.min(DAM.x - 1.4, LAKE.cx + LAKE.rx * 1.07 * Math.cos(a)), LAKE.cz + LAKE.rz * 1.07 * Math.sin(a)]); }
  lake.flat(pts, LAKE.y, M.lake);
  for (let x = -150; x < 880; x += x < 420 ? 4 : 40) {
    const x1 = x + (x < 420 ? 4 : 40), a = riverZ(x), b = riverZ(x1);
    river.quad([x, RIVER.y, a + 0.05], [x, RIVER.y, a + RIVER.w + 10], [x1, RIVER.y, b + RIVER.w + 10], [x1, RIVER.y, b + 0.05], M.river);
  }
  return { lake, river };
}

export function buildWorks() {
  const g = new Geo();
  // gravity dam: vertical upstream face, sloping downstream face
  const sec = [[-101.6, 43], [-101.6, DAM.crest], [-98.4, DAM.crest], [-98.4, 56.2], [-91.5, 43]];
  for (let i = 0; i < sec.length; i++) {
    const a = sec[i], b = sec[(i + 1) % sec.length];
    g.quad([a[0], a[1], DAM.z1], [b[0], b[1], DAM.z1], [b[0], b[1], DAM.z0], [a[0], a[1], DAM.z0], M.conc);
  }
  // parapets and spillway notch marks on the crest
  g.blk(-101.6, DAM.crest, DAM.z0, -101.3, DAM.crest + 0.9, DAM.z1, M.concD);
  g.blk(-98.7, DAM.crest, DAM.z0, -98.4, DAM.crest + 0.9, DAM.z1, M.concD);
  for (let z = DAM.z0 + 4; z < DAM.z1; z += 6) g.blk(-98.45, 47, z - 0.25, -98.3, 56.2, z + 0.25, M.concD);
  // intake tower in the lake, with a footbridge to the crest
  g.blk(-108.2, 46, PEN.z - 1.8, -104.6, DAM.crest + 0.4, PEN.z + 1.8, M.conc);
  g.blk(-108.5, DAM.crest + 0.4, PEN.z - 2.1, -104.3, DAM.crest + 3.4, PEN.z + 2.1, M.concD);
  g.blk(-108.8, DAM.crest + 3.4, PEN.z - 2.4, -104.0, DAM.crest + 3.7, PEN.z + 2.4, M.roof);
  g.blk(-104.6, DAM.crest - 0.3, PEN.z - 0.7, -101.6, DAM.crest, PEN.z + 0.7, M.concD);
  // penstock with stiffening bands and anchor blocks
  const path = penstockPath();
  g.tube(path, PEN.r, 20, M.pipe);
  for (let i = 3; i < path.length - 6; i += 4) {
    const p = path[i], q = path[i + 1], d = V3.norm(V3.sub(q, p));
    g.tube([V3.sub(p, V3.mul(d, 0.12)), V3.add(p, V3.mul(d, 0.12))], PEN.r + 0.07, 20, M.band, true);
    if (i % 8 === 3) { const gy = H(p[0], PEN.z); g.box(p[0], (gy - 1 + p[1] - 0.1) / 2, PEN.z, 2.0, p[1] - 0.1 - (gy - 1), 2.3, M.conc); }
  }
  g.box(-16.5, 0.6, PEN.z, 5, 3.4, 3.2, M.conc);                    // anchor block where the pipe goes underground
  g.box(DAM.x + 2.2, 50.0, PEN.z, 3.4, 3.4, 3.2, M.conc);           // outlet block at the toe of the dam
  // quay wall along the works (the stretch in front of the pit belongs to the powerhouse)
  g.blk(-26, -9.8, 6.95, -PIT.r, 0.35, 7.5, M.conc); g.blk(PIT.r, -9.8, 6.95, 47, 0.35, 7.5, M.conc);
  g.blk(-26, 0.35, 7.25, -9.2, 1.25, 7.5, M.concD); g.blk(9.2, 0.35, 7.25, 47, 1.25, 7.5, M.concD);
  return g;
}

export function buildTrees() {
  const g = new Geo();
  const greens = ['#2e5a2c', '#356a31', '#28502a', '#3d6f34'].map((c) => mat(c, { r: 0.95 }));
  for (let i = 0; i < 4200; i++) {
    const x = -360 + rnd(i, 1) * 840, z = -250 + rnd(i, 2) * 600;
    const h = H(x, z), e = 1.2, slope = Math.hypot(H(x + e, z) - h, H(x, z + e) - h) / e;
    if (slope > 0.75 || h < -0.8) continue;
    if (x > -34 && z > -24 && z < riverZ(x) + RIVER.w + 16) continue;                // works, corridor, town and the view across the river
    if (x > 262 && z < 16 && z > -64) continue;
    if (Math.abs(z - -2.9) < 5 && x < -20 && x > -104) continue;                    // penstock strip
    const el = ((x - LAKE.cx) / LAKE.rx) ** 2 + ((z - LAKE.cz) / LAKE.rz) ** 2;
    if (el < 1.25 || (x > -112 && x < -88 && z > DAM.z0 - 3 && z < DAM.z1 + 3)) continue;
    if (rnd(i, 5) > 0.35 + 0.5 * clamp(1 - h / 70, 0, 1) && h > 12) continue;       // sparser higher up
    const s = 0.8 + 0.9 * rnd(i, 3), G = greens[i % 4];
    g.cyl(x, h - 0.3, z, 0.22 * s, 1.9 * s, M.trunk, 5, 0.18 * s, false);
    g.cyl(x, h + 1.3 * s, z, 1.75 * s, 3.2 * s, G, 7, 0.55 * s, false);
    g.cyl(x, h + 3.5 * s, z, 1.25 * s, 3.2 * s, G, 7, 0.02, false);
  }
  return g;
}
