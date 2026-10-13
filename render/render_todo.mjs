// Renders the whole picture with several browser instances in parallel and joins the
// segments without re-encoding.
//   node render/render_todo.mjs --scale 0.5 --out salida/previo_540p.mp4 --workers 4 --crf 23 --preset veryfast     (preliminar)
//   node render/render_todo.mjs --scale 1 --out salida/imagen_1080p30.mp4 --workers 4      (1920 x 1080 nativo; --scale 2 = 3840 x 2160 nativo)
// The timeline is cut into short segments handled by a pool of workers. Every frame is a pure
// function of its number, so the result is identical to a single sequential render, and a
// segment that fails (for instance because another program stopped the encoder) is simply
// rendered again. Finished segments are kept, so the command can be re-run to resume.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '..');
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
const N = Number(opt('frames', 8550)), workers = Number(opt('workers', 4)), scale = opt('scale', '1'), out = path.resolve(ROOT, opt('out', 'salida/imagen.mp4'));
const from = Number(opt('from', 0)), to = Number(opt('to', N)), len = Number(opt('seg', 600));   // multiples of the GOP (60)
// segments are written outside the synced project folder: a sync client that opens a file while
// ffmpeg is still writing it makes the encoder fail
const tmp = path.join(opt('tmp', os.tmpdir()), 'hidro_render_' + path.basename(out, '.mp4'));
fs.mkdirSync(tmp, { recursive: true });
const segs = [];
for (let a = from; a < to; a += len) segs.push({ a, b: Math.min(to, a + len), file: path.join(tmp, `seg_${String(a).padStart(5, '0')}.mp4`), tries: 0 });
const framesOf = (f) => new Promise((res) => { let o = ''; const p = spawn('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', f]); p.stdout.on('data', (d) => (o += d)); p.on('close', () => res(Number(o.trim()) || 0)); p.on('error', () => res(0)); });
const t0 = Date.now();
let done = 0;
const queue = [];
for (const s of segs) { if (fs.existsSync(s.file) && fs.existsSync(s.file.replace(/\.mp4$/, '.csv')) && (await framesOf(s.file)) === s.b - s.a) done += s.b - s.a; else queue.push(s); }
if (done) console.log(`resuming: ${done} frames already rendered`);
const runOne = (s) => new Promise((res) => {
  const log = fs.openSync(s.file.replace(/\.mp4$/, '.log'), 'w');
  const p = spawn(process.execPath, [path.join(HERE, 'render.mjs'), '--quiet', '--scale', scale, '--fmt', opt('fmt', 'jpeg'), '--from', String(s.a), '--to', String(s.b), '--out', s.file, '--crf', opt('crf', '17'), '--preset', opt('preset', 'medium'), ...(args.includes('--subs') ? ['--subs', '1'] : []), ...(args.includes('--lang') ? ['--lang', opt('lang')] : [])], { stdio: ['ignore', log, log] });
  p.on('close', async (c) => { fs.closeSync(log); res(c === 0 && (await framesOf(s.file)) === s.b - s.a); });
});
async function worker() {
  for (;;) {
    const s = queue.shift(); if (!s) return;
    s.tries++;
    if (await runOne(s)) { done += s.b - s.a; console.log(`${((Date.now() - t0) / 60000).toFixed(1)} min  ${done}/${to - from} frames`); }
    else if (s.tries < 4) { console.log(`segment ${s.a} failed (attempt ${s.tries}); rendering it again`); queue.push(s); }
    else throw new Error(`segment ${s.a} failed four times, see ${s.file.replace(/\.mp4$/, '.log')}`);
  }
}
try {
  await Promise.all(Array.from({ length: workers }, worker));
  const list = path.join(tmp, 'lista.txt'), whole = path.join(tmp, 'completo.mp4');
  fs.writeFileSync(list, segs.map((s) => `file '${s.file.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', whole], { stdio: 'inherit' }).on('close', (c) => (c ? rej(new Error('concat failed')) : res())));
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.copyFileSync(whole, out);
  // one frame log for the whole video
  fs.writeFileSync(out.replace(/\.mp4$/, '.csv'), segs.map((s, i) => { const l = fs.readFileSync(s.file.replace(/\.mp4$/, '.csv'), 'utf8').split('\n'); return (i ? l.slice(1) : l).join('\n').trimEnd(); }).join('\n') + '\n');
  console.log(`wrote ${out} in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
} catch (e) { console.error(e.message); process.exitCode = 1; }
