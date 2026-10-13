# Versión en inglés del video principal: subtítulos, narración, unión de imagen y sonido y verificación.
# Pasos previos (ver LEEME.md): 0_guion_en.py, IDIOMA=en 1_voz.py, tiempos_en.json, render --lang en,
# IDIOMA=en 2_mezcla.py.
#   python audio/tools/5_version_en.py
import json, os, subprocess, sys, wave
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
E = os.path.join(ROOT, 'entregables')
J = lambda n: json.load(open(os.path.join(ROOT, 'datos', n + '.json'), encoding='utf-8'))
G, V, T = J('guion_en'), J('voz_en'), J('tiempos_en')
DUR, NF = float(T['S'][10]), int(T['fotogramas'])


def tc(t, srt=False):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}" if srt else f"{m:02d}:{s:02d}.{ms // 100}"

# ---------------------------------------------------------------- SRT and narration
n = 0; srt = []
for e in V['escenas']:
    for f in e['frases']:
        for k in f['cortes']:
            n += 1; tx = k['texto']; lineas = [tx]
            if len(tx) > 42:
                esp = [i for i, ch in enumerate(tx) if ch == ' ']; i = min(esp, key=lambda j: abs(j - len(tx) / 2)); lineas = [tx[:i], tx[i + 1:]]
            assert max(map(len, lineas)) <= 46, tx
            srt.append(f"{n}\n{tc(k['ini'], True)} --> {tc(max(k['fin'] - 0.04, k['ini'] + 0.5), True)}\n" + "\n".join(lineas) + "\n")
open(os.path.join(E, 'Subtitles_en.srt'), 'w', encoding='utf-8-sig', newline='\r\n').write("\n".join(srt))
g = [f"{G['titulo']} — narration", "", f"Voice: {V['voz']['nombre']} ({V['voz']['idioma']}), local Windows speech synthesis, one sentence per file.",
     f"{V['resumen']['palabras']} words; {V['resumen']['segundos_de_voz']} s of speech; {V['resumen']['ppm_solo_voz']} words per minute excluding pauses.", "Times measured on the final audio (minutes:seconds.tenths).", ""]
for e, ev in zip(G['escenas'], V['escenas']):
    g.append(f"Scene {e['n']} — {int(e['ini']) // 60:02d}:{int(e['ini']) % 60:02d} to {int(e['fin']) // 60:02d}:{int(e['fin']) % 60:02d} — {e['titulo']}")
    for fr, fv in zip(e['voz'], ev['frases']): g.append(f"  [{tc(fv['ini'])} – {tc(fv['fin'])}]  {fr['sub'].replace('|', ' ')}")
    g.append("")
open(os.path.join(E, 'Narration_en.txt'), 'w', encoding='utf-8').write("\n".join(g))

# ---------------------------------------------------------------- mux and verification
img, wav = os.path.join(ROOT, 'salida', 'imagen_1080p30_en.mp4'), os.path.join(ROOT, 'audio', 'mezcla_en_final.wav')
dst = os.path.join(E, 'Central_hidroelectrica_3D_educativo_1080p_EN.mp4')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', img, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
                '-metadata', 'title=From water to electricity', '-metadata', 'comment=Educational model; illustrative parameters', '-metadata:s:a:0', 'language=eng', '-movflags', '+faststart', '-shortest', dst], check=True)
j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_packets', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,profile,width,height,r_frame_rate,avg_frame_rate,nb_read_packets,pix_fmt,sample_rate,channels,duration', '-of', 'json', dst], capture_output=True, text=True).stdout)
v = next(s for s in j['streams'] if s['codec_type'] == 'video'); a = next(s for s in j['streams'] if s['codec_type'] == 'audio')
r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', dst, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
res = r[r.rindex('Summary:'):]; val = lambda k: float(res.split(k)[1].split()[0])
dec = subprocess.run(['ffmpeg', '-v', 'error', '-i', dst, '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr.strip()[:300]


def desfase(frase):
    tmp = os.path.join(ROOT, 'salida', '_seg.wav'); t0 = max(0, frase['ini'] - 1.0)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{t0:.3f}', '-t', f"{frase['dur'] + 2:.3f}", '-i', dst, '-map', '0:a:0', '-ac', '1', '-ar', '48000', tmp], check=True)
    lee = lambda p: np.frombuffer(wave.open(p, 'rb').readframes(10 ** 9), dtype=np.int16).astype(np.float64)
    x, y = lee(tmp), lee(os.path.join(ROOT, frase['archivo'])); os.remove(tmp)
    m = 1 << int(np.ceil(np.log2(len(x) + len(y)))); c = np.fft.irfft(np.fft.rfft(x, m) * np.conj(np.fft.rfft(y, m)), m)
    return round((t0 + int(np.argmax(c[: len(x)])) / 48000 - frase['ini']) * 1000, 1)


fr = [f for e in V['escenas'] for f in e['frases']]
inf = {'archivo': os.path.basename(dst), 'duracion_s': round(float(j['format']['duration']), 3), 'tamano_MB': round(int(j['format']['size']) / 1e6, 1), 'video': f"{v['codec_name']} {v.get('profile', '')} {v['width']}x{v['height']} {v['pix_fmt']}",
       'fps': v['r_frame_rate'], 'fps_medio': v['avg_frame_rate'], 'fotogramas': int(v['nb_read_packets']), 'audio': f"{a['codec_name']} {a['sample_rate']} Hz {a['channels']} canales", 'audio_duracion_s': round(float(a['duration']), 3),
       'lufs_integrado': val('I:'), 'pico_verdadero_dbtp': val('Peak:'), 'errores_de_decodificacion': dec,
       'sincronia_voz_ms': {'inicio': desfase(fr[0]), 'mitad': desfase(fr[len(fr) // 2]), 'final': desfase(fr[-1])}, 'subtitulos': n, 'voz': V['voz'], 'ppm_solo_voz': V['resumen']['ppm_solo_voz']}
ok = inf['fotogramas'] == NF and inf['fps'] == '30/1' and abs(inf['duracion_s'] - DUR) < 0.06 and abs(inf['audio_duracion_s'] - DUR) < 0.06 and not dec and '1920x1080 yuv420p' in inf['video'] and abs(inf['lufs_integrado'] + 16) < 1 and inf['pico_verdadero_dbtp'] <= -1.0 and all(abs(x) < 40 for x in inf['sincronia_voz_ms'].values())
inf['correcto'] = bool(ok)
json.dump(inf, open(os.path.join(ROOT, 'datos', 'verificacion_video_en.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(inf, ensure_ascii=False, indent=1)); sys.exit(0 if ok else 1)
