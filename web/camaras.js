// Camera plan: panorama -> medium shot -> detail cut, with steady shots during explanations.
// A view is {tx, ty, tz, az, el, ppm, ox, oy}: target, angles in degrees, pixels per metre at the
// target and pixel offset of the target in the 1920 x 1080 frame.
import { easeIO, lerp } from './util.js';
import { RUN, NOZ, nozzle, GEN, X } from './layout.js';

export function makeCameras(T) {
  const S = T.S, W = T.W, hero = nozzle(NOZ.hero);
  const V = {
    lake: { tx: -72, ty: 30, tz: 0, az: 9, el: 14, ppm: 6.2, ox: 0, oy: 40 },
    pano: { tx: 92, ty: 12, tz: 0, az: 0, el: 16, ppm: 3.2, ox: 0, oy: 60 },
    head: { tx: -62, ty: 27, tz: 0, az: 5, el: 15, ppm: 8.4, ox: 0, oy: 30 },
    pen: { tx: -22, ty: 7, tz: 0, az: 7, el: 13, ppm: 17, ox: 60, oy: 40 },
    house: { tx: 0, ty: 0.5, tz: 0, az: 13, el: 18, ppm: 40, ox: 0, oy: 0 },
    pit: { tx: 0.1, ty: -3.8, tz: 0.5, az: 14, el: 26, ppm: 128, ox: 0, oy: 0 },
    jet: { tx: hero.P[0] + 0.25, ty: RUN.y + 0.02, tz: hero.P[2] + 0.1, az: 7, el: 22, ppm: 235, ox: 30, oy: 0 },
    shaft: { tx: 0.2, ty: -1.9, tz: 1.6, az: 14, el: 20, ppm: 52, ox: 40, oy: 10 },
    gen: { tx: 0.15, ty: 2.05, tz: 0, az: 20, el: 19, ppm: 104, ox: 0, oy: 0 },
    gap: { tx: -1.3, ty: 2.2, tz: 0.9, az: 20, el: 23, ppm: 285, ox: 120, oy: 0 },
    genW: { tx: 0.15, ty: 2.0, tz: 0, az: 20, el: 19, ppm: 92, ox: -400, oy: -10 },
    sync: { tx: 9.6, ty: 2.3, tz: 0, az: 12, el: 17, ppm: 46, ox: 300, oy: 30 },
    trafo: { tx: X.trafo - 0.2, ty: 2.55, tz: 0, az: 15, el: 15, ppm: 100, ox: 60, oy: 20 },
    line: { tx: 72, ty: 11, tz: 0, az: 4, el: 12, ppm: 9.6, ox: 0, oy: 30 },
    sub1: { tx: X.sub1Tr, ty: 4.6, tz: 0, az: 9, el: 16, ppm: 27, ox: 0, oy: 40 },
    st: { tx: 236, ty: 5.5, tz: 0, az: 4, el: 13, ppm: 15, ox: 0, oy: 40 },
    dist: { tx: X.polesMV[X.poleTr] + 1.2, ty: 5.6, tz: 1.0, az: 11, el: 12, ppm: 84, ox: 0, oy: 60 },
    levels: { tx: 256, ty: 8, tz: 0, az: 0, el: 19, ppm: 6.9, ox: 0, oy: 50 },
    gov: { tx: hero.P[0] + 0.5, ty: RUN.y + 0.05, tz: hero.P[2] + 0.2, az: 7, el: 24, ppm: 205, ox: -450, oy: -60 },
    avr: { tx: -1.4, ty: 3.0, tz: -0.6, az: 20, el: 18, ppm: 74, ox: -440, oy: 0 },
    final: { tx: 9, ty: 0.9, tz: 0, az: 12, el: 15, ppm: 34, ox: 0, oy: 110 },
  };
  // [time, view, cut]. Between two keys the camera eases; a repeated view is a hold; cut = jump.
  const K = [
    [0, V.lake], [9.6, V.pano], [S[2] + 0.2, V.pano],
    [S[2] + 2.8, V.head], [W(2, 2, 'neto') + 1.2, V.head], [W(2, 3, 'cuatrocientos') + 1.4, V.pen], [S[3] + 0.2, V.pen],
    [S[3] + 2.3, V.pit], [W(3, 2, 'el') - 0.5, V.pit], [W(3, 2, 'golpea') + 0.3, V.jet], [W(3, 3, 'esa') - 0.5, V.jet], [W(3, 3, 'produce') + 0.6, V.pit],
    [W(3, 4, 'el') - 0.6, V.pit], [W(3, 4, 'transmite') + 0.6, V.shaft], [S[4] + 0.1, V.shaft],
    [S[4] + 3.4, V.gen], [W(4, 2, 'fijo') - 0.4, V.gen], [W(4, 3, 'ese') - 0.2, V.gap], [W(4, 4, 'los') - 0.4, V.gap], [W(4, 4, 'producir') - 0.2, V.genW], [S[5] + 0.1, V.genW],
    [S[5] + 3.0, V.sync], [T.trafoX - 0.6, V.sync], [T.trafoX + 1.6, V.trafo], [S[6] + 0.3, V.trafo],
    [S[6] + 3.3, V.line], [W(6, 1, 'llega') - 0.2, V.line], [W(6, 1, 'reducen') + 0.4, V.sub1], [W(6, 2, 'despues') + 0.4, V.sub1], [W(6, 2, 'alimentadores') + 0.3, V.st], [W(6, 3, 'un') - 0.5, V.st],
    [W(6, 3, 'distribucion') + 0.2, V.dist], [W(6, 4, 'cada') - 0.6, V.dist], [W(6, 4, 'equipos') + 0.2, V.levels], [S[7] - 0.02, V.levels],
    [S[7], V.gov, 1], [S[8] - 0.02, V.gov],
    [S[8], V.avr, 1], [S[9] - 0.02, V.avr],
    [S[9], V.pano, 1], [T.fin0 - 0.2, { ...V.pano, tx: 104 }], [T.fin0 + 3.0, V.final], [T.fin, { ...V.final, ppm: 35.5 }],
  ];
  return function cameraAt(t) {
    let i = 1;
    while (i < K.length - 1 && t >= K[i][0]) i++;
    const [t0, a] = K[i - 1], [t1, b, cut] = K[i];
    if (cut) return t >= t1 ? b : a;
    const u = easeIO((t - t0) / (t1 - t0)), o = {};
    // zoom is interpolated geometrically so that long pulls feel uniform
    for (const k in a) o[k] = k === 'ppm' ? Math.exp(lerp(Math.log(a[k]), Math.log(b[k]), u)) : lerp(a[k], b[k], u);
    return o;
  };
}
