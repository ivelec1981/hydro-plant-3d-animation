// Dependency-free WebGL2 renderer (adapted from the charging-station project).
// Physically based shading (GGX + analytic sky reflection), one sun with a soft PCF shadow map
// fitted to the shot, a shadowless fill light for cutaway interiors, animated water, sky pass,
// distance haze, ACES tone mapping. Per-object alpha, clip plane and highlight glow.
// render() is a pure function of the scene description it is given.

// ------------------------------------------------------------------ math
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 1, 0]; };
const mix3 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
export const V3 = { sub, add, mul, dot, cross, norm, mix: mix3, len: (a) => Math.hypot(a[0], a[1], a[2]) };

export const M4 = {
  ident: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  },
  ortho(l, r, b, t, n, f) {
    const o = new Float32Array(16);
    o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
    o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1;
    return o;
  },
  persp(fovy, aspect, n, f) {
    const o = new Float32Array(16), t = 1 / Math.tan(fovy / 2);
    o[0] = t / aspect; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = (2 * f * n) / (n - f);
    return o;
  },
  lookAt(e, c, up) {
    const z = norm(sub(e, c)), x = norm(cross(up, z)), y = cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]);
  },
  // rotation about the vertical axis; positive angles take +x towards +z
  rotY(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1]); },
  rotZ(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
  rotX(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); },
  trans(x, y, z) { return new Float32Array([x[0] !== undefined ? 1 : 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x[0] ?? x, x[1] ?? y, x[2] ?? z, 1]); },
  scale(x, y, z) { return new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]); },
  chain(...ms) { let o = ms[0]; for (let i = 1; i < ms.length; i++) o = M4.mul(o, ms[i]); return o; },
  about(p, r) { return M4.chain(M4.trans(p[0], p[1], p[2]), r, M4.trans(-p[0], -p[1], -p[2])); },
  // frame with origin o whose local +x axis is the unit vector ax (scaled sx along it, sr across)
  along(o, ax, sx = 1, sr = 1) {
    const u = norm(cross(Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], ax)), w = cross(ax, u);
    return new Float32Array([ax[0] * sx, ax[1] * sx, ax[2] * sx, 0, u[0] * sr, u[1] * sr, u[2] * sr, 0, w[0] * sr, w[1] * sr, w[2] * sr, 0, o[0], o[1], o[2], 1]);
  },
  apply(m, p) {
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return [(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w, (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w, (m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]) / w];
  },
  invert(m) {
    const a = Array.from(m), inv = new Float32Array(16);
    inv[0] = a[5] * a[10] * a[15] - a[5] * a[11] * a[14] - a[9] * a[6] * a[15] + a[9] * a[7] * a[14] + a[13] * a[6] * a[11] - a[13] * a[7] * a[10];
    inv[4] = -a[4] * a[10] * a[15] + a[4] * a[11] * a[14] + a[8] * a[6] * a[15] - a[8] * a[7] * a[14] - a[12] * a[6] * a[11] + a[12] * a[7] * a[10];
    inv[8] = a[4] * a[9] * a[15] - a[4] * a[11] * a[13] - a[8] * a[5] * a[15] + a[8] * a[7] * a[13] + a[12] * a[5] * a[11] - a[12] * a[7] * a[9];
    inv[12] = -a[4] * a[9] * a[14] + a[4] * a[10] * a[13] + a[8] * a[5] * a[14] - a[8] * a[6] * a[13] - a[12] * a[5] * a[10] + a[12] * a[6] * a[9];
    inv[1] = -a[1] * a[10] * a[15] + a[1] * a[11] * a[14] + a[9] * a[2] * a[15] - a[9] * a[3] * a[14] - a[13] * a[2] * a[11] + a[13] * a[3] * a[10];
    inv[5] = a[0] * a[10] * a[15] - a[0] * a[11] * a[14] - a[8] * a[2] * a[15] + a[8] * a[3] * a[14] + a[12] * a[2] * a[11] - a[12] * a[3] * a[10];
    inv[9] = -a[0] * a[9] * a[15] + a[0] * a[11] * a[13] + a[8] * a[1] * a[15] - a[8] * a[3] * a[13] - a[12] * a[1] * a[11] + a[12] * a[3] * a[9];
    inv[13] = a[0] * a[9] * a[14] - a[0] * a[10] * a[13] - a[8] * a[1] * a[14] + a[8] * a[2] * a[13] + a[12] * a[1] * a[10] - a[12] * a[2] * a[9];
    inv[2] = a[1] * a[6] * a[15] - a[1] * a[7] * a[14] - a[5] * a[2] * a[15] + a[5] * a[3] * a[14] + a[13] * a[2] * a[7] - a[13] * a[3] * a[6];
    inv[6] = -a[0] * a[6] * a[15] + a[0] * a[7] * a[14] + a[4] * a[2] * a[15] - a[4] * a[3] * a[14] - a[12] * a[2] * a[7] + a[12] * a[3] * a[6];
    inv[10] = a[0] * a[5] * a[15] - a[0] * a[7] * a[13] - a[4] * a[1] * a[15] + a[4] * a[3] * a[13] + a[12] * a[1] * a[7] - a[12] * a[3] * a[5];
    inv[14] = -a[0] * a[5] * a[14] + a[0] * a[6] * a[13] + a[4] * a[1] * a[14] - a[4] * a[2] * a[13] - a[12] * a[1] * a[6] + a[12] * a[2] * a[5];
    inv[3] = -a[1] * a[6] * a[11] + a[1] * a[7] * a[10] + a[5] * a[2] * a[11] - a[5] * a[3] * a[10] - a[9] * a[2] * a[7] + a[9] * a[3] * a[6];
    inv[7] = a[0] * a[6] * a[11] - a[0] * a[7] * a[10] - a[4] * a[2] * a[11] + a[4] * a[3] * a[10] + a[8] * a[2] * a[7] - a[8] * a[3] * a[6];
    inv[11] = -a[0] * a[5] * a[11] + a[0] * a[7] * a[9] + a[4] * a[1] * a[11] - a[4] * a[3] * a[9] - a[8] * a[1] * a[7] + a[8] * a[3] * a[5];
    inv[15] = a[0] * a[5] * a[10] - a[0] * a[6] * a[9] - a[4] * a[1] * a[10] + a[4] * a[2] * a[9] + a[8] * a[1] * a[6] - a[8] * a[2] * a[5];
    const det = a[0] * inv[0] + a[1] * inv[4] + a[2] * inv[8] + a[3] * inv[12];
    for (let i = 0; i < 16; i++) inv[i] /= det;
    return inv;
  },
};

const lin = (c) => Math.pow(c, 2.2);
export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [lin(((n >> 16) & 255) / 255), lin(((n >> 8) & 255) / 255), lin((n & 255) / 255)];
}
// material kinds understood by the shader
export const K = { plain: 0, concrete: 2, ground: 3, glass: 6, overlay: 7, water: 8 };
export function mat(hex, o = {}) {
  return { c: typeof hex === 'string' ? rgb(hex) : hex, m: o.m ?? 0, r: o.r ?? 0.6, e: o.e ?? 0, k: o.k ?? 0 };
}

// ------------------------------------------------------------------ geometry
// vertex = position(3) normal(3) albedo(3) metalness roughness emissive kind  -> 13 floats
const TAU = 6.283185307;
export class Geo {
  constructor() { this.v = []; }
  _p(p, n, M) { this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], M.c[0], M.c[1], M.c[2], M.m, M.r, M.e, M.k); }
  tri(a, b, c, M) { const n = norm(cross(sub(b, a), sub(c, a))); this._p(a, n, M); this._p(b, n, M); this._p(c, n, M); return this; }
  quad(a, b, c, d, M) { this.tri(a, b, c, M); return this.tri(a, c, d, M); }
  // append another geometry, transformed by a rigid matrix
  add(g, m) {
    const s = g.v;
    if (!m) { for (let i = 0; i < s.length; i++) this.v.push(s[i]); return this; }
    for (let i = 0; i < s.length; i += 13) {
      const x = s[i], y = s[i + 1], z = s[i + 2], nx = s[i + 3], ny = s[i + 4], nz = s[i + 5];
      this.v.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14],
        m[0] * nx + m[4] * ny + m[8] * nz, m[1] * nx + m[5] * ny + m[9] * nz, m[2] * nx + m[6] * ny + m[10] * nz,
        s[i + 6], s[i + 7], s[i + 8], s[i + 9], s[i + 10], s[i + 11], s[i + 12]);
    }
    return this;
  }
  box(cx, cy, cz, sx, sy, sz, M, rot = 0) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2, c = Math.cos(rot), s = Math.sin(rot);
    const P = (x, y, z) => [cx + x * c + z * s, cy + y, cz - x * s + z * c];
    const p = [P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz)];
    this.quad(p[4], p[5], p[6], p[7], M); this.quad(p[1], p[0], p[3], p[2], M);
    this.quad(p[5], p[1], p[2], p[6], M); this.quad(p[0], p[4], p[7], p[3], M);
    this.quad(p[7], p[6], p[2], p[3], M); this.quad(p[0], p[1], p[5], p[4], M);
    return this;
  }
  // axis-aligned box given by its two corners
  blk(x0, y0, z0, x1, y1, z1, M) { return this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, M); }
  // box with rounded edges and smooth normals
  rbox(cx, cy, cz, sx, sy, sz, r, M, rot = 0) {
    r = Math.min(r, sx / 2, sy / 2, sz / 2);
    const h = [sx / 2, sy / 2, sz / 2], c = Math.cos(rot), s = Math.sin(rot);
    const ax = (k) => [-h[k], -h[k] + 0.35 * r, -h[k] + r, h[k] - r, h[k] - 0.35 * r, h[k]];
    const A = [ax(0), ax(1), ax(2)];
    const vert = (q) => {
      const cl = q.map((v, k) => Math.max(-h[k] + r, Math.min(h[k] - r, v)));
      const n = norm(sub(q, cl));
      const p = [cl[0] + n[0] * r, cl[1] + n[1] * r, cl[2] + n[2] * r];
      return [[cx + p[0] * c + p[2] * s, cy + p[1], cz - p[0] * s + p[2] * c], [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c]];
    };
    for (let f = 0; f < 3; f++) for (const sgn of [-1, 1]) {
      const u = (f + 1) % 3, w = (f + 2) % 3;
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
        const mk = (a, b) => { const q = [0, 0, 0]; q[f] = sgn * h[f]; q[u] = A[u][a]; q[w] = A[w][b]; return vert(q); };
        const q = [mk(i, j), mk(i + 1, j), mk(i + 1, j + 1), mk(i, j + 1)];
        for (const t of [[0, 1, 2], [0, 2, 3]]) for (const k of t) this._p(q[k][0], q[k][1], M);
      }
    }
    return this;
  }
  // vertical cylinder / cone frustum with smooth side
  cyl(cx, y0, cz, r, hgt, M, seg = 16, r2 = r, caps = true) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU;
      const n0 = [Math.cos(a0), 0, Math.sin(a0)], n1 = [Math.cos(a1), 0, Math.sin(a1)];
      const b0 = [cx + n0[0] * r, y0, cz + n0[2] * r], b1 = [cx + n1[0] * r, y0, cz + n1[2] * r];
      const t0 = [cx + n0[0] * r2, y0 + hgt, cz + n0[2] * r2], t1 = [cx + n1[0] * r2, y0 + hgt, cz + n1[2] * r2];
      this._p(b0, n0, M); this._p(b1, n1, M); this._p(t1, n1, M); this._p(b0, n0, M); this._p(t1, n1, M); this._p(t0, n0, M);
      if (caps) { this.tri([cx, y0 + hgt, cz], t0, t1, M); this.tri([cx, y0, cz], b1, b0, M); }
    }
    return this;
  }
  sphere(cx, cy, cz, rx, ry, rz, M, seg = 12) {
    const P = (i, j) => {
      const th = (i / seg) * Math.PI, ph = (j / (seg * 2)) * TAU;
      const n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      return [[cx + n[0] * rx, cy + n[1] * ry, cz + n[2] * rz], norm([n[0] / rx, n[1] / ry, n[2] / rz])];
    };
    for (let i = 0; i < seg; i++) for (let j = 0; j < seg * 2; j++) {
      const q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)];
      for (const t of [[0, 1, 2], [0, 2, 3]]) for (const k of t) this._p(q[k][0], q[k][1], M);
    }
    return this;
  }
  // tube along a polyline; r is a number or one radius per point; caps close the ends
  tube(pts, r, sides, M, caps = false) {
    const R = (i) => (typeof r === 'number' ? r : r[i]);
    let u0 = null;
    const rings = pts.map((p, i) => {
      const t = norm(sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]));
      // transport the previous frame to avoid twists
      let u = u0 ? sub(u0, mul(t, dot(u0, t))) : cross(t, Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]);
      if (Math.hypot(u[0], u[1], u[2]) < 1e-6) u = cross(t, [1, 0, 0]);
      u = norm(u); u0 = u; const w = cross(t, u);
      // slope of the radius, for the normals of cones
      const dr = (R(Math.min(pts.length - 1, i + 1)) - R(Math.max(0, i - 1))) / (Math.hypot(...sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)])) || 1);
      const ring = [];
      for (let k = 0; k < sides; k++) { const a = (k / sides) * TAU, n = [u[0] * Math.cos(a) + w[0] * Math.sin(a), u[1] * Math.cos(a) + w[1] * Math.sin(a), u[2] * Math.cos(a) + w[2] * Math.sin(a)]; ring.push([[p[0] + n[0] * R(i), p[1] + n[1] * R(i), p[2] + n[2] * R(i)], norm(sub(n, mul(t, dr)))]); }
      return ring;
    });
    for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < sides; k++) {
      const q = [rings[i][k], rings[i + 1][k], rings[i + 1][(k + 1) % sides], rings[i][(k + 1) % sides]];
      for (const t of [[0, 1, 2], [0, 2, 3]]) for (const j of t) this._p(q[j][0], q[j][1], M);
    }
    if (caps) for (const [ring, c, flip] of [[rings[0], pts[0], false], [rings[rings.length - 1], pts[pts.length - 1], true]])
      for (let k = 0; k < sides; k++) { const a = ring[k][0], b = ring[(k + 1) % sides][0]; flip ? this.tri(c, a, b, M) : this.tri(c, b, a, M); }
    return this;
  }
  // solid annular sector around a vertical axis: radii r0..r1, heights y0..y1, angles a0..a1 (radians).
  // Mc is the material of the two radial cut faces (drawn only when the sector is not a full ring).
  ring(cx, cz, r0, r1, y0, y1, a0, a1, M, seg = 48, Mc = M) {
    const full = a1 - a0 > TAU - 1e-4, n = Math.max(2, Math.ceil((seg * (a1 - a0)) / TAU));
    const P = (r, a, y) => [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];
    for (let i = 0; i < n; i++) {
      const p = a0 + ((a1 - a0) * i) / n, q = a0 + ((a1 - a0) * (i + 1)) / n;
      const np = [Math.cos(p), 0, Math.sin(p)], nq = [Math.cos(q), 0, Math.sin(q)], mp = [-np[0], 0, -np[2]], mq = [-nq[0], 0, -nq[2]];
      // outer wall
      this._p(P(r1, p, y0), np, M); this._p(P(r1, q, y0), nq, M); this._p(P(r1, q, y1), nq, M); this._p(P(r1, p, y0), np, M); this._p(P(r1, q, y1), nq, M); this._p(P(r1, p, y1), np, M);
      if (r0 > 1e-6) { this._p(P(r0, p, y0), mp, M); this._p(P(r0, q, y1), mq, M); this._p(P(r0, q, y0), mq, M); this._p(P(r0, p, y0), mp, M); this._p(P(r0, p, y1), mp, M); this._p(P(r0, q, y1), mq, M); }
      this.quad(P(r0, p, y1), P(r1, p, y1), P(r1, q, y1), P(r0, q, y1), M);
      this.quad(P(r0, p, y0), P(r0, q, y0), P(r1, q, y0), P(r1, p, y0), M);
    }
    if (!full) {
      this.quad(P(r0, a0, y0), P(r1, a0, y0), P(r1, a0, y1), P(r0, a0, y1), Mc);
      this.quad(P(r0, a1, y0), P(r0, a1, y1), P(r1, a1, y1), P(r1, a1, y0), Mc);
    }
    return this;
  }
  // lofted surface: P[i][j] positions, Mt material or Mt[i][j]; smooth normals; wrap in j
  grid(P, Mt, wrap = true) {
    const n = P.length, m = P[0].length, N = [], MM = (i, j) => (Array.isArray(Mt) ? Mt[i][j] : Mt);
    for (let i = 0; i < n; i++) {
      N.push([]);
      for (let j = 0; j < m; j++) {
        const a = P[Math.min(n - 1, i + 1)][j], b = P[Math.max(0, i - 1)][j];
        const c = P[i][wrap ? (j + 1) % m : Math.min(m - 1, j + 1)], d = P[i][wrap ? (j + m - 1) % m : Math.max(0, j - 1)];
        let nn = cross(sub(a, b), sub(c, d));
        if (Math.hypot(nn[0], nn[1], nn[2]) < 1e-10) nn = [0, 1, 0];
        N[i].push(norm(nn));
      }
    }
    const jm = wrap ? m : m - 1;
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < jm; j++) {
      const j1 = (j + 1) % m, id = [[i, j], [i + 1, j], [i + 1, j1], [i, j1]];
      for (const t of [[0, 1, 2], [0, 2, 3]]) for (const k of t) { const [a, b] = id[k]; this._p(P[a][b], N[a][b], MM(a, b)); }
    }
    return this;
  }
  // flat polygon, points [[x,z],...] star-shaped about their centroid (faces up)
  flat(pts, y, M) {
    const n = pts.length, up = [0, 1, 0];
    const cx = pts.reduce((a, p) => a + p[0], 0) / n, cz = pts.reduce((a, p) => a + p[1], 0) / n;
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; this._p([cx, y, cz], up, M); this._p([b[0], y, b[1]], up, M); this._p([a[0], y, a[1]], up, M); }
    return this;
  }
  rect(x0, z0, x1, z1, y, M) { return this.flat([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], y, M); }
  // cone with its base centre at p, pointing along the unit vector d
  cone(p, d, r, h, M, seg = 12) {
    const u = norm(cross(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), w = cross(d, u), tip = add(p, mul(d, h));
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * TAU, b = ((i + 1) / seg) * TAU;
      const A = add(p, add(mul(u, r * Math.cos(a)), mul(w, r * Math.sin(a)))), B = add(p, add(mul(u, r * Math.cos(b)), mul(w, r * Math.sin(b))));
      this.tri(A, B, tip, M); this.tri(p, B, A, M);
    }
    return this;
  }
}

// ------------------------------------------------------------------ shaders
const COMMON = `
precision highp float; precision highp sampler2DShadow;
uniform sampler2DShadow uShadow; uniform vec3 uSun; uniform float uDim; uniform vec2 uFog; uniform float uBias;
const vec3 SUN0=vec3(2.75,2.55,2.25); const vec3 SKYUP=vec3(.60,.71,.88); const vec3 GND=vec3(.29,.28,.25);
const vec3 HAZE=vec3(.66,.78,.92);
const float EXPOSURE=.5;
const vec2 PD[16]=vec2[16](vec2(-.94,-.40),vec2(.95,-.77),vec2(-.09,-.93),vec2(.34,.29),vec2(-.92,.46),vec2(-.82,-.88),vec2(-.38,.28),vec2(.97,.76),
  vec2(.44,-.98),vec2(.54,.77),vec2(.79,.19),vec2(-.24,1.),vec2(-.81,.91),vec2(.2,-.14),vec2(.14,.79),vec2(-.42,-.3));
float shadowAt(vec4 lp){
  vec3 p=lp.xyz/lp.w*.5+.5;
  if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.) return 1.;
  float s=0.; for(int i=0;i<16;i++) s+=texture(uShadow, vec3(p.xy+PD[i]*(2.2/4096.), p.z-uBias));
  return s/16.;
}
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x), f.y); }
vec3 sky(vec3 d){
  float h=clamp(d.y,0.,1.);
  vec3 c=mix(vec3(.66,.80,.97), vec3(.22,.42,.80), pow(h,.5));
  c+=vec3(1.,.9,.7)*pow(max(dot(d,uSun),0.),90.)*.5;
  if(d.y<0.) c=mix(vec3(.66,.80,.97), vec3(.34,.40,.38), clamp(-d.y*5.,0.,1.));
  return c;
}
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
vec3 finish(vec3 c, float dist){
  float f=1.-exp(-max(dist-uFog.x,0.)*uFog.y);
  c=mix(c, HAZE*1.5, f*.8);
  return pow(aces(c*EXPOSURE)*uDim, vec3(1./2.2));
}`;
const VS = `#version 300 es
in vec3 aPos; in vec3 aNor; in vec3 aCol; in vec4 aMat;
uniform mat4 uVP, uModel, uLightVP;
out vec3 vN; out vec3 vCol; out vec4 vMat; out vec4 vLP; out vec3 vW;
void main(){ vec4 w=uModel*vec4(aPos,1.); vW=w.xyz; vN=mat3(uModel)*aNor; vCol=aCol; vMat=aMat; vLP=uLightVP*w; gl_Position=uVP*w; }`;
const FS = `#version 300 es
${COMMON}
in vec3 vN; in vec3 vCol; in vec4 vMat; in vec4 vLP; in vec3 vW;
uniform vec3 uEye; uniform vec4 uTint, uGlow, uClip, uFill; uniform float uSat, uTime;
out vec4 o;
void main(){
  if(dot(vW,uClip.xyz)>uClip.w) discard;
  int kind=int(vMat.w+.5);
  vec3 V=normalize(uEye-vW); vec3 N=normalize(vN); if(dot(N,V)<0.) N=-N;
  if(kind==7){ o=vec4(pow(vCol*uTint.rgb*uDim, vec3(1./2.2)), uTint.a); return; }
  float metal=vMat.x, rough=clamp(vMat.y,.05,1.), em=vMat.z;
  vec3 alb=vCol*uTint.rgb;
  if(kind==2||kind==3){
    vec2 q=abs(N.y)>.6 ? vW.xz : (abs(N.x)>abs(N.z) ? vW.zy : vW.xy);
    float n1=vnoise(q*2.4), n2=vnoise(q*.16+7.3), n3=vnoise(q*.031+2.1);
    if(kind==2) alb*=1.+.08*(n1-.5)+.14*(n2-.5);
    else { alb*=1.+.10*(n1-.5)+.30*(n2-.5)+.30*(n3-.5); alb.r*=1.+.22*(n3-.5); }
  }
  if(kind==8){
    vec2 q=vW.xz;
    float e=.35;
    float hx=vnoise(q*.9+vec2(uTime*.55,uTime*.21))-vnoise(q*.9+vec2(e,0.)+vec2(uTime*.55,uTime*.21));
    float hz=vnoise(q*.9+vec2(uTime*.55,uTime*.21))-vnoise(q*.9+vec2(0.,e)+vec2(uTime*.55,uTime*.21));
    float gx=vnoise(q*3.1-vec2(uTime*.9,uTime*.4))-vnoise(q*3.1+vec2(e,0.)-vec2(uTime*.9,uTime*.4));
    float gz=vnoise(q*3.1-vec2(uTime*.9,uTime*.4))-vnoise(q*3.1+vec2(0.,e)-vec2(uTime*.9,uTime*.4));
    N=normalize(N+vec3(hx*.35+gx*.16,0.,hz*.35+gz*.16));
    rough=.09; metal=0.;
  }
  if(kind==6){ alb=vec3(.035,.045,.055); }
  float NdV=max(dot(N,V),.001);
  vec3 F0=mix(vec3(.04), alb, metal); if(kind==6) F0=vec3(.11); if(kind==8) F0=vec3(.03);
  float sh=shadowAt(vLP);
  vec3 L=uSun, H=normalize(V+L);
  float NdL=max(dot(N,L),0.), NdH=max(dot(N,H),0.), VdH=max(dot(V,H),0.);
  float a=rough*rough, a2=a*a, d=NdH*NdH*(a2-1.)+1., D=a2/(3.14159*d*d);
  float k=(rough+1.)*(rough+1.)/8., G=(NdL/(NdL*(1.-k)+k))*(NdV/(NdV*(1.-k)+k));
  vec3 F=F0+(1.-F0)*pow(1.-VdH,5.);
  vec3 spec=min(D*G*F/(4.*NdL*NdV+.001), vec3(6.));
  vec3 kd=(1.-F)*(1.-metal);
  vec3 col=(kd*alb+spec)*SUN0*NdL*sh;
  vec3 hemi=mix(GND, SKYUP, N.y*.5+.5);
  vec3 R=reflect(-V,N);
  vec3 env=mix(sky(R), hemi*1.15, clamp(rough*1.25,0.,1.));
  vec3 Fe=F0+(max(vec3(1.-rough),F0)-F0)*pow(1.-NdV,5.);
  col+=alb*(1.-metal)*hemi*(.75+.25*sh) + env*Fe*(.55+.45*sh);
  // shadowless fill light for cutaway interiors
  float fl=max(dot(N,uFill.xyz),0.);
  col+=(kd*alb*(.55+.45*fl)+ F0*metal*pow(max(dot(N,normalize(V+uFill.xyz)),0.),18.)*1.4)*uFill.w*vec3(1.,.96,.9)*fl;
  if(kind==8){
    float fr=.03+.97*pow(1.-NdV,5.);
    vec3 deep=alb*(.35+.65*sh)*(.55+.9*NdL);
    col=mix(deep, sky(R)*1.05, clamp(fr*1.25,0.,1.))+spec*SUN0*NdL*sh;
  }
  col=mix(col, alb*2.6, em);
  col+=uGlow.rgb*uGlow.a*(.35+.65*pow(1.-NdV,2.))*1.7;
  float l=dot(col,vec3(.3,.59,.11)); col=mix(vec3(l)*.6, col, uSat);
  o=vec4(finish(col, length(uEye-vW)), uTint.a);
}`;
const VSD = `#version 300 es
in vec3 aPos; uniform mat4 uVP, uModel; out vec3 vW; void main(){ vec4 w=uModel*vec4(aPos,1.); vW=w.xyz; gl_Position=uVP*w; }`;
const FSD = `#version 300 es
precision highp float; in vec3 vW; uniform vec4 uClip; out vec4 o; void main(){ if(dot(vW,uClip.xyz)>uClip.w) discard; o=vec4(1.); }`;
const VSS = `#version 300 es
out vec2 vP; void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2))*2.-1.; vP=p; gl_Position=vec4(p,.9999,1.); }`;
const FSS = `#version 300 es
${COMMON}
in vec2 vP; uniform mat4 uInv; uniform vec3 uEye; out vec4 o;
void main(){ vec4 w=uInv*vec4(vP,1.,1.); vec3 d=normalize(w.xyz/w.w-uEye); o=vec4(pow(aces(sky(d)*1.55*EXPOSURE)*uDim, vec3(1./2.2)),1.); }`;

const NOCLIP = [0, 0, 0, 1e9], ZERO4 = [0, 0, 0, 0], ONE4 = [1, 1, 1, 1];

export class Renderer {
  constructor(canvas) {
    const gl = (this.gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true, alpha: false }));
    if (!gl) throw new Error('WebGL2 not available');
    this.canvas = canvas;
    this.main = this.program(VS, FS);
    this.depth = this.program(VSD, FSD);
    this.skyP = this.program(VSS, FSS);
    const S = (this.shadowSize = 4096);
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, S, S);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.emptyVao = gl.createVertexArray();
    // mid-morning sun from the front left, so the faces towards the camera are lit
    this.sun = norm([-0.5, 0.74, 0.5]);
  }
  program(vs, fs) {
    const gl = this.gl;
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aNor'); gl.bindAttribLocation(p, 2, 'aCol'); gl.bindAttribLocation(p, 3, 'aMat');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  mesh(geo, dynamic = false) {
    const gl = this.gl, vao = gl.createVertexArray(), buf = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.v), dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 52, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 52, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 52, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 52, 36);
    gl.bindVertexArray(null);
    return { vao, buf, count: geo.v.length / 13 };
  }
  // replace the contents of a dynamic mesh (flows, droplets)
  update(mesh, geo) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.v), gl.DYNAMIC_DRAW);
    mesh.count = geo.v.length / 13;
  }
  // cam: {tx, ty, tz, az, el, ppm, ox, oy}: look-at target, angles in degrees, pixels per metre at
  // the target and pixel offset of the target, both in the 1920 x 1080 layout frame. A long lens
  // keeps perspective convergence mild.
  camera(cam) {
    const W = this.canvas.width, H = this.canvas.height, k = W / 1920, fov = ((cam.fov || 22) * Math.PI) / 180;
    const a = (cam.az * Math.PI) / 180, e = (cam.el * Math.PI) / 180, ty = cam.ty || 0;
    const D = H / 2 / (cam.ppm * k) / Math.tan(fov / 2);
    const eye = [cam.tx + Math.sin(a) * Math.cos(e) * D, ty + Math.sin(e) * D, cam.tz + Math.cos(a) * Math.cos(e) * D];
    const shift = M4.ident(); shift[12] = (2 * (cam.ox || 0) * k) / W; shift[13] = (-2 * (cam.oy || 0) * k) / H;
    const vp = M4.mul(shift, M4.mul(M4.persp(fov, W / H, Math.max(0.3, D * 0.12), D * 6 + 900), M4.lookAt(eye, [cam.tx, ty, cam.tz], [0, 1, 0])));
    // shadow map fitted to what the shot shows
    const hs = Math.min(460, (1500 / cam.ppm) * 1.0), c = [cam.tx - Math.sin(a) * hs * 0.25, ty, cam.tz - Math.cos(a) * hs * 0.25], far = hs * 5;
    const lightVP = M4.mul(M4.ortho(-hs, hs, -hs, hs, 1, far), M4.lookAt([c[0] + this.sun[0] * far * 0.5, c[1] + this.sun[1] * far * 0.5, c[2] + this.sun[2] * far * 0.5], c, [0, 1, 0]));
    return { vp, eye, D, lightVP, bias: 0.0016, fog: [D * 1.05 + 30, 0.55 / (D + 200)] };
  }
  // world point -> layout pixels (1920 x 1080 frame); third value < 0 when behind the camera
  project(vp, p) {
    const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
    const x = (vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12]) / w, y = (vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13]) / w;
    return [(x * 0.5 + 0.5) * 1920, (1 - (y * 0.5 + 0.5)) * 1080, w];
  }
  // scene: {vp, eye, lightVP, bias, fog, dim, time, fill:[x,y,z,k], opaque:[item], blend:[item]}
  // item: {mesh, model, tint, glow, sat, clip, count, noShadow}
  render(scene) {
    const gl = this.gl, I = M4.ident();
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.depthMask(true); gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.shadowSize, this.shadowSize);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.depth.p);
    gl.uniformMatrix4fv(this.depth.u.uVP, false, scene.lightVP);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2.0, 4);
    for (const d of scene.opaque) {
      if (d.noShadow) continue;
      gl.uniformMatrix4fv(this.depth.u.uModel, false, d.model || I);
      gl.uniform4fv(this.depth.u.uClip, d.clip || NOCLIP);
      gl.bindVertexArray(d.mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, d.count ?? d.mesh.count);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const dim = scene.dim ?? 1;
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const common = (pr) => {
      gl.useProgram(pr.p);
      gl.uniform3fv(pr.u.uSun, this.sun);
      gl.uniform3fv(pr.u.uEye, scene.eye);
      gl.uniform1f(pr.u.uDim, dim);
      if (pr.u.uFog) gl.uniform2fv(pr.u.uFog, scene.fog);
    };
    // sky
    common(this.skyP);
    gl.uniformMatrix4fv(this.skyP.u.uInv, false, M4.invert(scene.vp));
    gl.depthMask(false); gl.bindVertexArray(this.emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.depthMask(true);
    const m = this.main;
    common(m);
    gl.uniformMatrix4fv(m.u.uVP, false, scene.vp);
    gl.uniformMatrix4fv(m.u.uLightVP, false, scene.lightVP);
    gl.uniform1f(m.u.uBias, scene.bias);
    gl.uniform1f(m.u.uTime, scene.time || 0);
    gl.uniform4fv(m.u.uFill, scene.fill || ZERO4);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex); gl.uniform1i(m.u.uShadow, 0);
    const draw = (d) => {
      gl.uniformMatrix4fv(m.u.uModel, false, d.model || I);
      gl.uniform4fv(m.u.uTint, d.tint || ONE4);
      gl.uniform4fv(m.u.uGlow, d.glow || ZERO4);
      gl.uniform4fv(m.u.uClip, d.clip || NOCLIP);
      gl.uniform1f(m.u.uSat, d.sat ?? 1);
      gl.bindVertexArray(d.mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, d.count ?? d.mesh.count);
    };
    for (const d of scene.opaque) draw(d);
    gl.enable(gl.BLEND); gl.depthMask(false);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    for (const d of scene.blend) {
      if (d.depthWrite) gl.depthMask(true); if (d.noDepth) gl.disable(gl.DEPTH_TEST);
      draw(d);
      if (d.depthWrite) gl.depthMask(false); if (d.noDepth) gl.enable(gl.DEPTH_TEST);
    }
    gl.disable(gl.BLEND); gl.depthMask(true);
    gl.bindVertexArray(null);
  }
}
