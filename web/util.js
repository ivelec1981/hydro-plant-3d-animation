// Shared constants and small helpers. No state.
export const FPS = 30;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, u) => a + (b - a) * u;
export const ss = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
export const easeIO = (u) => { u = clamp(u, 0, 1); return u * u * u * (u * (6 * u - 15) + 10); };
// 0 -> 1 between t0 and t0+fi, 1 -> 0 between t1-fo and t1
export const env = (t, t0, t1, fi = 0.4, fo = 0.4) => Math.min(ss(t0, t0 + fi, t), 1 - ss(t1 - fo, t1, t));
// largest window value: wins = [[t0, t1], ...]
export const win = (t, wins, fi = 0.8, fo = 0.8) => { let a = 0; for (const [a0, a1] of wins) a = Math.max(a, env(t, a0, a1, fi, fo)); return a; };
export const DEG = Math.PI / 180;

// functional palette (labels and symbols always accompany the colour)
export const COL = {
  agua: '#3d9be9', mec: '#f5a623', elec: '#2fd4a7', campo: '#a67cf0', inst: '#1F4E79',
  L1: '#2fd4a7', L2: '#49b8f2', L3: '#c3e55a', txt: '#f3f6f9', dim: '#b4c0cc', rojo: '#ef5b5b',
};

// deterministic pseudo-random numbers and smooth value noise (terrain, scatter)
export const rnd = (i, k = 0) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
export function noise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const h = (a, b) => rnd(a * 57 + b * 131, 3);
  return lerp(lerp(h(xi, zi), h(xi + 1, zi), u), lerp(h(xi, zi + 1), h(xi + 1, zi + 1), u), v);
}
export const fbm = (x, z) => 0.5 * noise2(x, z) + 0.25 * noise2(x * 2.1 + 5, z * 2.1 + 9) + 0.125 * noise2(x * 4.3 + 1, z * 4.3 + 4) + 0.0625 * noise2(x * 8.7, z * 8.7);
// value of a uniformly sampled series at time t (linear interpolation)
export const serie = (arr, dt, t) => { const x = clamp(t / dt, 0, arr.length - 1), i = Math.min(arr.length - 2, Math.floor(x)); return lerp(arr[i], arr[i + 1], x - i); };
// piecewise-linear map: pts = [[x0, y0], [x1, y1], ...]
export const pw = (pts, x) => { if (x <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])); return pts[pts.length - 1][1]; };
let DEC = ',';
export const setDecimal = (c) => { DEC = c; };
export const fmt = (x, d = 1) => x.toFixed(d).replace('.', DEC);
