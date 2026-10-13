// Spatial layout of the master scene. Model units are metres of a didactic mock-up: heights and
// distances are compressed ("Esquema espacial simplificado"); the 400 m head is a datum, not a
// dimension of the model. X runs from the reservoir (-) to the consumers (+); the camera looks
// from +Z. Everything that several modules must agree on lives here.
import { ss, lerp, fbm, clamp, DEG } from './util.js';

// ---------------------------------------------------------------- turbine (vertical-shaft Pelton)
export const RUN = { R: 1.05, y: -4.0, n: 22, a: 0.2, b: 0.115, c: 0.13 };      // pitch radius, plane, buckets, bucket semi-axes
export const NOZ = { n: 6, phi0: -15 * DEG, ringR: 2.9, back: 2.7, tip: 0.45, hero: 2 };
export const nozzle = (k) => {
  const phi = NOZ.phi0 + (k * 2 * Math.PI) / NOZ.n, r = [Math.cos(phi), 0, Math.sin(phi)], t = [-Math.sin(phi), 0, Math.cos(phi)];
  const P = [RUN.R * r[0], RUN.y, RUN.R * r[2]];                                    // tangent point on the pitch circle
  const at = (s) => [P[0] + t[0] * s, RUN.y, P[2] + t[2] * s];                      // point on the jet axis, s metres past P
  return { phi, r, t, P, at, J: at(-NOZ.back), tip: at(-NOZ.tip) };
};
export const PIT = { r: 4.2, floor: -6.8, water: -6.3, half: 7, bottom: -7.4 };
export const CASE = { r0: 1.8, r1: 1.88, y0: -4.8, y1: -3.05 };

// ---------------------------------------------------------------- generator (vertical, salient poles)
export const GEN = {
  poles: 20, yc: 1.8, rimR: 1.25, bodyR: 1.55, shoeR: 1.66, boreR: 1.74, coreR: 2.32, frameR: 2.58,
  core: [1.02, 2.58], frame: [0.42, 3.3], rotorH: 1.5, shaftR: 0.2, top: 4.55,
  cut: [-8 * DEG, 148 * DEG],              // removable front sector (towards the camera)
};
export const HALL = { x0: -9, x1: 9, z0: -8, z1: 7, h: 9.4, wall: 0.4 };

// ---------------------------------------------------------------- electrical corridor (along +x, on z = 0)
export const X = {
  gcb: 11.6, trafo: 17.6, hvBrk: 25.5, ct: 28.6, dis: 31.8, gantry: 37,
  towers: [62, 104, 146], sub1In: 172, sub1Brk: 177.5, sub1Tr: 185.5, sub1Brk2: 192.5, sub1Out: 198,
  poles69: [212, 228, 244], sub2In: 257, sub2Tr: 264, sub2Sw: 270.5,
  polesMV: [279, 293, 307, 321, 335], poleTr: 2,          // index of the pole that carries the distribution transformer
  houses: [284, 296, 309, 322, 334], cityX0: 345,
};
export const ZL = 4;            // z of the medium-voltage pole line (the street runs in front of it)
export const LAKE = { y: 56.5, cx: -152, cz: -6, rx: 50, rz: 42 };
export const DAM = { x: -100, z0: -26, z1: 20, crest: 58.6 };
export const RIVER = { y: -7.6, bed: -9.4, w: 27 };
export const riverZ = (x) => 7.35 + 34 * ss(45, 120, x);

// ---------------------------------------------------------------- terrain height
export function H(x, z) {
  const zr = riverZ(x);
  const n1 = fbm(x * 0.021 + 11, z * 0.021 + 5) - 0.47, n2 = fbm(x * 0.0061 + 3, z * 0.0061 + 1) - 0.47;
  // valley floor: flat inside the works, gently rolling elsewhere
  const town = ss(262, 276, x) * (1 - ss(392, 410, x)) * (1 - ss(14, 22, z)) * ss(-62, -50, z);
  const works = Math.max((1 - ss(16, 30, Math.abs(z))) * ss(-30, -22, x), town);
  let h = (1 - works) * (n1 * 1.6 + n2 * 4) * ss(-10, 30, Math.abs(z) - 10);
  // mountain on the left; its top is lower where the dam closes the valley
  const top = 60 - 10 * (1 - ss(13, 24, Math.abs(z + 3))) + 16 * n2 * ss(20, 60, Math.abs(z + 3));
  const up = ss(-24, -96, x);
  let hill = top * up * (1 + 0.25 * n1 * up);
  // ranges behind the valley and beyond the lake
  const back = ss(-26, -150, z), city = 1 - 0.8 * ss(250, 330, x);
  h += back * city * (30 + 110 * (fbm(x * 0.0045 + 2, z * 0.004 + 8) - 0.3)) * (0.35 + 0.65 * ss(-60, -260, z));
  hill += ss(-190, -330, x) * (30 + 90 * fbm(x * 0.005, z * 0.005 + 4));
  // the river comes out of a gorge in front of the mountain
  const gorge = ss(zr + 12, zr + 28, z) * (1 - ss(zr + 44, zr + 80, z)) * (1 - ss(-55, -100, x));
  hill *= (1 - 0.8 * gorge) * (1 - 0.93 * ss(34, 96, z));        // the mountain opens towards the camera
  h += hill;
  // lake basin
  const e = ((x - LAKE.cx) / LAKE.rx) ** 2 + ((z - LAKE.cz) / LAKE.rz) ** 2;
  h = lerp(44 + 6 * e, h, ss(0.86, 1.12, e));
  // river channel with a quay wall along the works and a natural bank downstream
  if (x > -140) {
    const bank = 0.12 + 7 * ss(46, 70, x) + 5 * ss(-24, -40, x), far = zr + RIVER.w;
    const inR = ss(zr, zr + bank, z) * (1 - ss(far, far + 16, z));
    const bed = RIVER.bed + 0.3 * hill + 0.5 * n1;
    h = lerp(h, bed, inR * (1 - ss(-38, -84, x)));
    // low hills on the near bank, in front of the camera
    h += ss(far + 10, far + 90, z) * (4 + 26 * n2 + 3 * n1) * (1 - 0.6 * up);
  }
  return h;
}

// colour of the ground from height and slope (linear RGB)
export function groundColor(x, z, h, slope) {
  const n = fbm(x * 0.03 + 40, z * 0.03 + 7);
  let c = [0.085 + 0.05 * n, 0.17 + 0.07 * n, 0.045];                   // grass
  const dry = [0.2, 0.19, 0.085], rock = [0.3, 0.285, 0.25], sand = [0.3, 0.27, 0.2];
  const mix = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
  c = mix(c, dry, clamp((h - 25) / 60, 0, 0.7) * (0.5 + n));
  c = mix(c, rock, 0.85 * ss(0.3, 0.8, slope + 0.25 * (n - 0.5)));
  c = mix(c, sand, ss(-1.5, -5, h) * (1 - ss(-200, -260, x)));
  return c;
}
// catenary-like sag between two points (n segments, sag in metres at mid-span)
export function span(a, b, sag, n = 14) {
  const p = [];
  for (let i = 0; i <= n; i++) { const u = i / n; p.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u) - sag * 4 * u * (1 - u), lerp(a[2], b[2], u)]); }
  return p;
}
