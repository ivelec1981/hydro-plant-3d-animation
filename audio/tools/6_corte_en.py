# Copias en inglés para redes: (1) video completo con subtítulos incrustados y (2) corte corto
# (menos de 90 s) montado con tramos del video completo, con su propia mezcla de sonido y subtítulos.
#   python audio/tools/6_corte_en.py
# El corte incluye el tramo del campo giratorio (salida/clip_campo_en.mp4, voz en datos/voz_campo_en.json).
# Entradas: salida/imagen_1080p30_en.mp4, salida/clip_campo_en.mp4, audio/voz_en/*.wav, audio/voz_campo_en/*.wav, audio/sin_voz_en_final.wav, datos/voz_en.json,
#           entregables/Central_hidroelectrica_3D_educativo_1080p_EN.mp4 y Subtitles_en.srt
import json, os, subprocess, sys, wave
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
E = os.path.join(ROOT, 'entregables'); SR = 48000
BASE = 'Central_hidroelectrica_3D_educativo_1080p_EN'
V = json.load(open(os.path.join(ROOT, 'datos', 'voz_en.json'), encoding='utf-8'))
VC = json.load(open(os.path.join(ROOT, 'datos', 'voz_campo_en.json'), encoding='utf-8'))
SOLO_CORTE = '--solo-corte' in sys.argv          # no rehace la copia subtitulada del video completo
run = lambda a, **k: subprocess.run(a, check=True, **k)
ESTILO = "FontName=Bahnschrift,FontSize=11,PrimaryColour=&H00F9F6F3,BorderStyle=3,OutlineColour=&H330E0803,BackColour=&H330E0803,Outline=3,Shadow=0,MarginV=11,Alignment=2"
X264 = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-g', '60', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709']
META = ['-metadata', 'title=From water to electricity', '-metadata', 'comment=Educational model; illustrative parameters', '-metadata:s:a:0', 'language=eng']


def incrusta(origen, srt, destino):
    run(['ffmpeg', '-y', '-loglevel', 'error', '-i', origen, '-vf', f"subtitles={srt}:force_style='{ESTILO}'", *X264, '-c:a', 'copy', *META, '-movflags', '+faststart', destino], cwd=E)

# ---------------------------------------------------------------- 1) full video with burned-in subtitles
if not SOLO_CORTE: incrusta(BASE + '.mp4', 'Subtitles_en.srt', BASE + '_subtitled.mp4')

# ---------------------------------------------------------------- 2) short cut
# Tramos (origen, inicio, fin) en segundos, múltiplos de 0,1 s = 3 fotogramas. Cada uno contiene frases enteras.
# 'v' = video completo en inglés; 'c' = tramo del campo giratorio (se inserta tras el cierre del interruptor).
FUENTE = {'v': (os.path.join(ROOT, 'salida', 'imagen_1080p30_en.mp4'), V), 'c': (os.path.join(ROOT, 'salida', 'clip_campo_en.mp4'), VC)}
TRAMOS = [('v', 0.0, 6.4), ('v', 35.5, 47.3), ('v', 52.6, 68.9), ('v', 85.6, 98.5), ('v', 123.9, 127.6), ('c', 0.0, 24.0), ('v', 129.3, 136.0), ('v', 272.5, 285.0)]
FUND = 0.4                                                        # fundido encadenado entre tramos
ini_nuevo = []; t = 0.0
for _, a, b in TRAMOS: ini_nuevo.append(t); t += (b - a) - FUND
DUR = t + FUND
mapa = lambda x, k: ini_nuevo[k] + (x - TRAMOS[k][1])
frases = []
for k, (src, a, b) in enumerate(TRAMOS):
    for e in FUENTE[src][1]['escenas']:
        for f in e['frases']:
            if f['ini'] >= a and f['fin'] <= b: frases.append((k, f))
print(f"corte: {DUR:.1f} s, {len(TRAMOS)} tramos, {len(frases)} frases")
for k, f in frases: print(f"  {mapa(f['ini'], k):6.2f}  {' '.join(c['texto'] for c in f['cortes'])}")

# imagen: tramos de la imagen final unidos con fundidos
ins = []; fc = []
for k, (src, a, b) in enumerate(TRAMOS):
    ins += ['-ss', f'{a:.3f}', '-t', f'{b - a:.3f}', '-i', FUENTE[src][0]]; fc.append(f'[{k}:v]fps=30,format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS[s{k}]')
prev = 's0'
for k in range(1, len(TRAMOS)):
    fc.append(f'[{prev}][s{k}]xfade=transition=fade:duration={FUND}:offset={ini_nuevo[k]:.3f}[x{k}]'); prev = f'x{k}'
mudo = os.path.join(ROOT, 'salida', 'corte_en_imagen.mp4')
run(['ffmpeg', '-y', '-loglevel', 'error', *ins, '-filter_complex', ';'.join(fc), '-map', f'[{prev}]', *X264, '-r', '30', mudo])

# sonido: las frases originales en su nuevo instante sobre un tramo continuo de música y ambiente
def lee(p):
    with wave.open(p, 'rb') as w: return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0, w.getnchannels()
N = int(DUR * SR); v = np.zeros(N, np.float32)
for k, f in frases:
    x, _ = lee(os.path.join(ROOT, f['archivo'])); i = int(mapa(f['ini'], k) * SR); v[i:i + len(x)] += x[: N - i]
X = np.fft.rfft(v); fr = np.fft.rfftfreq(N, 1 / SR); v = np.fft.irfft(X / np.sqrt(1 + (80 / np.maximum(fr, 1e-6)) ** 4), N).astype(np.float32)
v *= 10 ** (-3 / 20) / np.max(np.abs(v))
suav = lambda x, s: (lambda k, c: ((c[k:] - c[:-k]) / k).astype(np.float32))(int(s * SR), np.cumsum(np.concatenate([[0.0], x.astype(np.float64)])))
hay = (np.abs(v) > 10 ** (-40 / 20)).astype(np.float32)
act = np.minimum(1.0, suav(np.pad(hay, (int(0.35 * SR), int(0.9 * SR))), 0.9)[:N] * 2.6); act = suav(np.pad(act, (int(0.15 * SR), int(0.3 * SR))), 0.3)[:N]
fondo, ch = lee(os.path.join(ROOT, 'audio', 'sin_voz_en_final.wav')); fondo = fondo.reshape(-1, ch)[:N]
tt = np.arange(N) / SR
fondo = fondo * np.interp(tt, [0, 1.0, DUR - 3.0, DUR - 0.3, DUR], [0, 1, 1, 0, 0])[:, None].astype(np.float32) * 0.62
mix = np.stack([v, v], 1) + fondo * (1 - 0.66 * act)[:, None]
mix *= min(1.0, 10 ** (-1.5 / 20) / np.max(np.abs(mix)))
src, wav = os.path.join(ROOT, 'audio', 'corte_en.wav'), os.path.join(ROOT, 'audio', 'corte_en_final.wav')
with wave.open(src, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
def mide(p):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', p, '-af', 'loudnorm=I=-16:TP=-1.2:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace')
    return json.loads(r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1])
m = mide(src)
run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-af', f"loudnorm=I=-16:TP=-1.2:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true", '-ar', str(SR), '-c:a', 'pcm_s16le', wav])
os.remove(src)

# subtítulos del corte y archivos finales
def tc(t): ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); mi, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000); return f"{h:02d}:{mi:02d}:{s:02d},{ms:03d}"
srt = []; n = 0
for k, f in frases:
    for c in f['cortes']:
        n += 1; tx = c['texto']; lin = [tx]
        if len(tx) > 42: esp = [i for i, q in enumerate(tx) if q == ' ']; i = min(esp, key=lambda j: abs(j - len(tx) / 2)); lin = [tx[:i], tx[i + 1:]]
        srt.append(f"{n}\n{tc(mapa(c['ini'], k))} --> {tc(mapa(max(c['fin'] - 0.04, c['ini'] + 0.5), k))}\n" + "\n".join(lin) + "\n")
open(os.path.join(E, 'Subtitles_en_90s.srt'), 'w', encoding='utf-8-sig', newline='\r\n').write("\n".join(srt))
limpio = os.path.join(E, BASE + '_90s.mp4')
run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mudo, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', *META, '-movflags', '+faststart', '-shortest', limpio])
incrusta(BASE + '_90s.mp4', 'Subtitles_en_90s.srt', BASE + '_90s_subtitled.mp4')
os.remove(mudo)

# ---------------------------------------------------------------- verification
def sonda(nombre):
    p = os.path.join(E, nombre)
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_packets', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,nb_read_packets,pix_fmt,sample_rate,duration', '-of', 'json', p], capture_output=True, text=True).stdout)
    vi = next(s for s in j['streams'] if s['codec_type'] == 'video'); au = next(s for s in j['streams'] if s['codec_type'] == 'audio')
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', p, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
    res = r[r.rindex('Summary:'):]; val = lambda q: float(res.split(q)[1].split()[0])
    dec = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr.strip()[:200]
    return {'archivo': nombre, 'duracion_s': round(float(j['format']['duration']), 3), 'tamano_MB': round(int(j['format']['size']) / 1e6, 1), 'video': f"{vi['codec_name']} {vi['width']}x{vi['height']} {vi['pix_fmt']} {vi['avg_frame_rate']}",
            'fotogramas': int(vi['nb_read_packets']), 'audio': f"{au['codec_name']} {au['sample_rate']} Hz", 'audio_duracion_s': round(float(au['duration']), 3), 'lufs': val('I:'), 'pico_dbtp': val('Peak:'), 'errores': dec}
inf = [sonda(BASE + '_subtitled.mp4'), sonda(BASE + '_90s.mp4'), sonda(BASE + '_90s_subtitled.mp4')]
LIMITE = 95        # el corte debe quedar cerca de 90 s
ok = all(not o['errores'] and '1920x1080 yuv420p 30/1' in o['video'] and abs(o['lufs'] + 16) < 1 and o['pico_dbtp'] <= -1 and abs(o['duracion_s'] - o['audio_duracion_s']) < 0.1 for o in inf) and inf[1]['duracion_s'] <= LIMITE and 0 <= round(DUR * 30) - inf[1]['fotogramas'] <= 6      # los encadenados dejan unos fotogramas menos al final, ya en negro
json.dump({'correcto': bool(ok), 'corte_s': round(DUR, 2), 'tramos': TRAMOS, 'frases': len(frases), 'subtitulos_corte': n, 'archivos': inf}, open(os.path.join(ROOT, 'datos', 'verificacion_redes_en.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('correcto:', ok)
for o in inf: print(o)
sys.exit(0 if ok else 1)
