# Une la imagen final con la banda sonora y verifica los archivos resultantes.
#   python audio/tools/4_union.py
# Entradas: salida/imagen_1080p30.mp4 (y, si existe, salida/imagen_2160p30.mp4), audio/*_final.wav,
#           entregables/Subtitulos_es.srt
# Salidas en entregables/: versión con voz, versión sin voz, copia con subtítulos incrustados y,
#           si se renderizó, máster 4K nativo. Informe en datos/verificacion_video.json.
import json, os, subprocess, sys, wave
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
E = os.path.join(ROOT, 'entregables'); os.makedirs(E, exist_ok=True)
BASE = 'Central_hidroelectrica_3D_educativo'
img = os.path.join(ROOT, 'salida', 'imagen_1080p30.mp4'); img4k = os.path.join(ROOT, 'salida', 'imagen_2160p30.mp4')
con, sin = os.path.join(ROOT, 'audio', 'mezcla_final.wav'), os.path.join(ROOT, 'audio', 'sin_voz_final.wav')
tm = json.load(open(os.path.join(ROOT, 'datos', 'tiempos.json'), encoding='utf-8')); voz = json.load(open(os.path.join(ROOT, 'datos', 'voz.json'), encoding='utf-8'))
DUR, NF = float(tm['S'][10]), int(tm['fotogramas'])
META = ['-metadata', 'title=Del agua a la electricidad', '-metadata', 'comment=Modelo educativo; parámetros ilustrativos', '-metadata:s:a:0', 'language=spa']
run = lambda a, **k: subprocess.run(a, check=True, **k)
AAC = ['-c:a', 'aac', '-b:a', '256k', '-ar', '48000']
out = {}
# un resultado se rehace solo si falta o si alguna de sus entradas es más reciente
al_dia = lambda dst, *src: os.path.exists(dst) and all(os.path.getmtime(dst) > os.path.getmtime(x) for x in src)
def une(video, audio, nombre):
    dst = os.path.join(E, nombre)
    if al_dia(dst, video, audio): return dst
    run(['ffmpeg', '-y', '-loglevel', 'error', '-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', *AAC, *META, '-movflags', '+faststart', '-shortest', dst])
    return dst
out['con_voz'] = une(img, con, BASE + '_1080p.mp4')
out['sin_voz'] = une(img, sin, BASE + '_1080p_sin_voz.mp4')
# copia adicional con subtítulos incrustados (el archivo principal queda limpio y el SRT va aparte)
estilo = "FontName=Bahnschrift,FontSize=11,PrimaryColour=&H00F9F6F3,BorderStyle=3,OutlineColour=&H330E0803,BackColour=&H330E0803,Outline=3,Shadow=0,MarginV=11,Alignment=2"
out['subtitulado'] = os.path.join(E, BASE + '_1080p_subtitulado.mp4')
if not al_dia(out['subtitulado'], out['con_voz'], os.path.join(E, 'Subtitulos_es.srt')):
  run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.basename(out['con_voz']), '-vf', f"subtitles=Subtitulos_es.srt:force_style='{estilo}'", '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-g', '60',
       '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:a', 'copy', *META, '-movflags', '+faststart', os.path.basename(out['subtitulado'])], cwd=E)
if os.path.exists(img4k): out['master_4k'] = une(img4k, con, BASE + '_2160p_master.mp4')


def sonda(p):
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_packets', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,profile,width,height,r_frame_rate,avg_frame_rate,nb_read_packets,pix_fmt,sample_rate,channels,duration', '-of', 'json', p], capture_output=True, text=True).stdout)
    v = next(s for s in j['streams'] if s['codec_type'] == 'video'); a = next((s for s in j['streams'] if s['codec_type'] == 'audio'), None)
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', p, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
    res = r[r.rindex('Summary:'):]; val = lambda k: float(res.split(k)[1].split()[0])
    # decodificación completa: confirma que el archivo se reproduce de principio a fin sin errores
    dec = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace')
    return {'archivo': os.path.basename(p), 'duracion_s': round(float(j['format']['duration']), 3), 'tamano_MB': round(int(j['format']['size']) / 1e6, 1), 'video': f"{v['codec_name']} {v.get('profile', '')} {v['width']}x{v['height']} {v['pix_fmt']}",
            'fps': v['r_frame_rate'], 'fps_medio': v['avg_frame_rate'], 'fotogramas': int(v['nb_read_packets']), 'audio': f"{a['codec_name']} {a['sample_rate']} Hz {a['channels']} canales", 'audio_duracion_s': round(float(a['duration']), 3),
            'lufs_integrado': val('I:'), 'pico_verdadero_dbtp': val('Peak:'), 'errores_de_decodificacion': dec.stderr.strip()[:300]}


def desfase(mp4, frase):
    """Desfase (ms) entre la locución dentro del MP4 y el instante previsto de una frase."""
    tmp = os.path.join(ROOT, 'salida', '_seg.wav'); t0 = max(0, frase['ini'] - 1.0)
    run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{t0:.3f}', '-t', f"{frase['dur'] + 2:.3f}", '-i', mp4, '-map', '0:a:0', '-ac', '1', '-ar', '48000', tmp])
    lee = lambda p: np.frombuffer(wave.open(p, 'rb').readframes(10 ** 9), dtype=np.int16).astype(np.float64)
    a, b = lee(tmp), lee(os.path.join(ROOT, frase['archivo'])); os.remove(tmp)
    n = 1 << int(np.ceil(np.log2(len(a) + len(b)))); x = np.fft.irfft(np.fft.rfft(a, n) * np.conj(np.fft.rfft(b, n)), n)
    lag = int(np.argmax(x[: len(a)])); return round((t0 + lag / 48000 - frase['ini']) * 1000, 1)


frases = [f for e in voz['escenas'] for f in e['frases']]
inf = {k: sonda(p) for k, p in out.items()}
sync = {n: {'frase_en_s': f['ini'], 'desfase_ms': desfase(out['con_voz'], f)} for n, f in (('inicio', frases[0]), ('mitad', frases[len(frases) // 2]), ('final', frases[-1]))}
ok = all(o['fotogramas'] == NF and o['fps'] == '30/1' and o['fps_medio'] == '30/1' and abs(o['duracion_s'] - DUR) < 0.06 and abs(o['audio_duracion_s'] - DUR) < 0.06 and not o['errores_de_decodificacion'] and 'h264' in o['video'] and 'yuv420p' in o['video'] and 'aac 48000' in o['audio'] for o in inf.values())
ok = ok and '1920x1080' in inf['con_voz']['video'] and all(abs(s['desfase_ms']) < 40 for s in sync.values()) and abs(inf['con_voz']['lufs_integrado'] + 16) < 1 and inf['con_voz']['pico_verdadero_dbtp'] <= -1.0
if 'master_4k' in inf: ok = ok and '3840x2160' in inf['master_4k']['video']
res = {'correcto': bool(ok), 'duracion_prevista_s': DUR, 'fotogramas_previstos': NF, 'archivos': inf, 'sincronia_voz': sync}
json.dump(res, open(os.path.join(ROOT, 'datos', 'verificacion_video.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(res, ensure_ascii=False, indent=1))
sys.exit(0 if ok else 1)
