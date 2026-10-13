// Frame composer. renderFrame(f) is a pure function of the frame number:
//   frame -> time -> camera, model state, graphic layer.
import { Renderer } from './engine.js';
import { FPS, setDecimal } from './util.js';
import { makeTimes } from './tiempos.js';
import { createWorld } from './escena.js';
import { makeCameras } from './camaras.js';
import { createHud } from './hud.js';

const params = new URLSearchParams(location.search), rendering = params.has('render');
const lang = params.get('lang') || 'es', suf = lang === 'es' ? '' : '_' + lang;          // ?lang=en: English narration and on-screen text
if (lang === 'en') setDecimal('.');
const [guion, voz, series] = await Promise.all(['guion' + suf, 'voz' + suf, 'series_web'].map((n) => fetch(`../datos/${n}.json`, { cache: 'no-store' }).then((r) => r.json())));
const canvas = document.getElementById('gl');
const scale = rendering ? window.devicePixelRatio : 1;          // 1 = 1920 x 1080, 2 = native 3840 x 2160
canvas.width = Math.round(1920 * scale); canvas.height = Math.round(1080 * scale);
await document.fonts.ready;

const renderer = new Renderer(canvas);
const T = makeTimes(voz, series, lang);
const world = createWorld(renderer, T, series);
const cameraAt = makeCameras(T);
// ?clip=campo renders a stand-alone insert (its own short timeline and graphics) instead of the main video
let clip = null;
if (params.get('clip') === 'campo') {
  const vozClip = await fetch(`../datos/voz_campo${suf || '_en'}.json`, { cache: 'no-store' }).then((r) => r.json());
  clip = (await import('./clip_campo.js')).createClipCampo(document.getElementById('hud'), document.getElementById('lines'), vozClip, world, renderer);
}
const N_FRAMES = clip ? clip.frames : Math.round(T.fin * FPS);
const hud = clip ? null : createHud(document.getElementById('hud'), document.getElementById('lines'), guion, voz, T, world, series, params.has('subs') || !rendering, lang);

function renderFrame(f) {
  f = Math.max(0, Math.min(N_FRAMES - 1, Math.round(f)));
  if (clip) return clip.render(f);
  const t = f / FPS, cp = cameraAt(t), camera = { ...renderer.camera(cp), ...cp };
  const { scene, info } = world.frame(t, camera, cp.ppm);
  const h = hud.update(t, (p) => renderer.project(camera.vp, p), info);
  scene.dim = h.dim;
  renderer.render(scene);
  return { f, t, scene: h.scene, labels: h.labels };
}
// Label audit over the whole timeline (no drawing): most simultaneous labels per scene.
function audit() {
  const out = { maxLabels: 0, perScene: {}, over: [] };
  for (let f = 0; f < N_FRAMES; f += 3) {
    const t = f / FPS, cp = cameraAt(t), camera = { ...renderer.camera(cp), ...cp }, { info } = world.frame(t, camera, cp.ppm);
    const h = hud.update(t, (p) => renderer.project(camera.vp, p), info);
    out.perScene[h.scene] = Math.max(out.perScene[h.scene] || 0, h.labels); out.maxLabels = Math.max(out.maxLabels, h.labels);
    if (h.labels > 4 && (!out.over.length || t - out.over[out.over.length - 1] > 1)) out.over.push(Number(t.toFixed(1)));
  }
  return out;
}
Object.assign(window, { renderFrame, audit, N_FRAMES, T, world });

if (rendering) {
  document.body.classList.add('render'); if (params.has('subs')) document.body.classList.add('subs');
  renderFrame(Number(params.get('f') || 0));
} else {
  const stage = document.getElementById('stage'), scrub = document.getElementById('scrub'), pos = document.getElementById('pos'), play = document.getElementById('play');
  scrub.max = N_FRAMES - 1;
  const fit = () => { const k = Math.min(innerWidth / 1920, (innerHeight - 34) / 1080); stage.style.transform = `scale(${k})`; };
  addEventListener('resize', fit); fit();
  let playing = !params.has('f'), t0 = performance.now(), f0 = Number(params.get('f') || 0);
  play.textContent = playing ? 'Pausa' : 'Reproducir';
  play.onclick = () => { playing = !playing; play.textContent = playing ? 'Pausa' : 'Reproducir'; t0 = performance.now(); f0 = Number(scrub.value); };
  scrub.oninput = () => { f0 = Number(scrub.value); t0 = performance.now(); const r = renderFrame(f0); pos.textContent = `${r.t.toFixed(1)} s · escena ${r.scene}`; };
  const loop = (now) => {
    if (playing) { const f = (f0 + ((now - t0) / 1000) * FPS) % N_FRAMES; scrub.value = f; const r = renderFrame(f); pos.textContent = `${r.t.toFixed(1)} s · escena ${r.scene}`; }
    requestAnimationFrame(loop);
  };
  scrub.value = f0; renderFrame(f0);
  requestAnimationFrame(loop);
}
window.ready = true;
