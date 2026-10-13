// Offline renderer: captures frames from a headless browser and encodes the picture.
//
//   node render/render.mjs --stills 0,450,900            PNG stills -> salida/stills
//   node render/render.mjs --scale 0.5 --out salida/previo.mp4          low-resolution preview
//   node render/render.mjs --scale 2 --from 0 --to 4200 --out salida/seg_0.mp4   one segment, native 4K
//   node render/render.mjs --audit                        label count and vehicle-overlap audit
//
// No npm dependencies: static file server + Chrome DevTools Protocol over Node's built-in
// WebSocket + ffmpeg on PATH. --scale sets the device pixel ratio: the WebGL canvas and the
// vector layer are both rasterised at that density, so 2 is a native 3840 x 2160 render.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1] ?? true; };
const stills = opt('stills') ? String(opt('stills')).split(',').map(Number) : null;
const scale = Number(opt('scale') || 1), FPS = 30, W = 1920, H = 1080;
// --fmt jpeg captures high-quality JPEG frames (much faster than PNG at 4K); PNG is the lossless default
const fmt = opt('fmt') === 'jpeg' ? 'jpeg' : 'png';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
if (!exe) throw new Error('Chrome or Edge not found');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hidro-'));
const dbg = 9300 + Math.floor(Math.random() * 600);
const browser = spawn(exe, ['--headless=new', `--remote-debugging-port=${dbg}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`, '--hide-scrollbars',
  '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--force_high_performance_gpu', '--disable-extensions', '--no-first-run', '--mute-audio', '--force-color-profile=srgb', 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { browser.kill(); } catch {} server.close(); setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} }, 500); };

let wsUrl;
for (let i = 0; i < 100 && !wsUrl; i++) {
  await new Promise((r) => setTimeout(r, 150));
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${dbg}/json/list`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch {}
}
if (!wsUrl) { cleanup(); throw new Error('could not reach the browser'); }
const ws = new WebSocket(wsUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { const [res, rej] = pending.get(msg.id); pending.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); }
  else if (msg.method === 'Runtime.exceptionThrown') console.error('PAGE ERROR:', msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
  else if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) console.error('PAGE:', msg.params.args.map((a) => a.value ?? a.description).join(' '));
};
const cdp = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, [res, rej]); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

let code = 0;
try {
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: scale, mobile: false });
  await cdp('Page.navigate', { url: `http://127.0.0.1:${port}/web/index.html?render=1${opt('subs') ? '&subs=1' : ''}${opt('lang') ? '&lang=' + opt('lang') : ''}${opt('clip') ? '&clip=' + opt('clip') : ''}` });
  for (let i = 0; ; i++) { if (await evaluate('window.ready === true').catch(() => false)) break; if (i > 300) throw new Error('page did not become ready'); await new Promise((r) => setTimeout(r, 100)); }
  if (!opt('quiet')) console.log('renderer:', await evaluate(`(()=>{const g=document.getElementById('gl');const c=g.getContext('webgl2');const e=c.getExtension('WEBGL_debug_renderer_info');return (e?c.getParameter(e.UNMASKED_RENDERER_WEBGL):'unknown')+' | canvas '+g.width+'x'+g.height})()`));

  const shot = async (f) => {
    const info = JSON.parse(await evaluate(`JSON.stringify(window.renderFrame(${f}))`));
    const { data } = await cdp('Page.captureScreenshot', { format: fmt, quality: 98, clip: { x: 0, y: 0, width: W, height: H, scale: 1 }, captureBeyondViewport: false, optimizeForSpeed: true });
    return { png: Buffer.from(data, 'base64'), info };
  };

  if (opt('bench')) {
    const f0 = Number(opt('bench')); let t0 = Date.now();
    for (let f = f0; f < f0 + 20; f++) await evaluate(`window.renderFrame(${f}).f`);
    const a = (Date.now() - t0) / 20; t0 = Date.now();
    for (let f = f0; f < f0 + 20; f++) await shot(f);
    console.log(`scale ${scale} ${fmt}: compose ${a.toFixed(0)} ms/frame, compose+capture ${((Date.now() - t0) / 20).toFixed(0)} ms/frame`);
  } else if (opt('eval')) console.log(await evaluate(String(opt('eval'))));
  else if (opt('audit')) { const a = await evaluate('JSON.stringify(window.audit())'); fs.writeFileSync(path.join(ROOT, 'datos', 'auditoria_animacion.json'), JSON.stringify(JSON.parse(a), null, 1)); console.log(a); }
  else if (stills) {
    const dir = path.join(ROOT, 'salida', 'stills'); fs.mkdirSync(dir, { recursive: true });
    for (const f of stills) { const { png, info } = await shot(f); fs.writeFileSync(path.join(dir, `f${String(f).padStart(5, '0')}.png`), png); console.log(JSON.stringify(info)); }
  } else {
    const n = await evaluate('window.N_FRAMES'), from = Number(opt('from') || 0), to = Math.min(n, Number(opt('to') || n));
    const target = path.resolve(ROOT, String(opt('out') || 'salida/video.mp4'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'warning', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', fmt === 'jpeg' ? 'mjpeg' : 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', String(opt('preset') || 'slow'), '-crf', String(opt('crf') || 16), '-pix_fmt', 'yuv420p', '-vf', 'scale=out_color_matrix=bt709:out_range=tv',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-g', '60', '-bf', '2', '-movflags', '+faststart', '-r', String(FPS), target], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', (c) => (c ? rej(new Error('ffmpeg exit ' + c)) : res())));
    const log = [], t0 = Date.now();
    for (let f = from; f < to; f++) {
      const { png, info } = await shot(f);
      log.push([f, info.t.toFixed(4), info.scene, info.labels].join(','));
      if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
      if ((f - from) % 300 === 0) console.log(`frame ${f} (${from}-${to})  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    ff.stdin.end();
    await done;
    fs.writeFileSync(target.replace(/\.mp4$/, '.csv'), 'frame,t,escena,rotulos\n' + log.join('\n') + '\n');
    console.log(`wrote ${target}  ${to - from} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
} catch (e) { console.error(e.stack || e); code = 1; } finally { ws.close(); cleanup(); }
process.exitCode = code;
