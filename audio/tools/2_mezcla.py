# Banda sonora: locución (audio/voz), ambiente hidráulico y mecánico sintetizado, música
# instrumental original sintetizada y mezcla con reducción automática bajo la voz.
#   python audio/tools/2_mezcla.py
# Salidas (48 kHz, estéreo): audio/mezcla_final.wav (-16 LUFS integrados, pico verdadero <= -1 dBTP)
# y audio/sin_voz_final.wav (misma música y ambiente, sin locución). Medición en datos/audio_medicion.json.
# Todo el material es original: no se usa ninguna grabación ni biblioteca de terceros.
import json, os, subprocess, wave
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SR = 48000
SUF = '_' + os.environ['IDIOMA'] if os.environ.get('IDIOMA') else ''
voz = json.load(open(os.path.join(ROOT, 'datos', 'voz' + SUF + '.json'), encoding='utf-8'))
tm = json.load(open(os.path.join(ROOT, 'datos', 'tiempos' + SUF + '.json'), encoding='utf-8'))
S = tm['S']; DUR = float(S[10]); N = int(SR * DUR)
rng = np.random.default_rng(20261012)


def db(x): return 10 ** (x / 20)
def lee(path):
    with wave.open(path, 'rb') as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
def escribe(path, x):
    x = np.clip(x, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(x.shape[1]); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())
def filtro(x, f_lo=None, f_hi=None, orden=2):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); H = np.ones_like(f)
    if f_lo: H *= 1 / np.sqrt(1 + (f_lo / np.maximum(f, 1e-6)) ** (2 * orden))
    if f_hi: H *= 1 / np.sqrt(1 + (f / f_hi) ** (2 * orden))
    return np.fft.irfft(X * H, len(x)).astype(np.float32)
def suaviza(x, seg):
    k = max(1, int(seg * SR)); c = np.cumsum(np.concatenate([[0.0], x.astype(np.float64)]))
    return ((c[k:] - c[:-k]) / k).astype(np.float32) if len(x) > k else x
def pon(buf, x, t, g=1.0, pan=0.0):
    i = int(t * SR)
    if i >= N or i + len(x) <= 0: return
    x = x[max(0, -i):]; i = max(0, i); x = x[: N - i]
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(x), 0] += x * g * gl * 1.414; buf[i:i + len(x), 1] += x * g * gr * 1.414
t_all = np.arange(N, dtype=np.float64) / SR
def curva(pts): return np.interp(t_all, [p[0] for p in pts], [p[1] for p in pts]).astype(np.float32)

# ------------------------------------------------------------------ locución
v = np.zeros(N, np.float32)
for e in voz['escenas']:
    for f in e['frases']:
        x = lee(os.path.join(ROOT, f['archivo'])); i = int(f['ini'] * SR); v[i:i + len(x)] += x[: N - i]
v = filtro(v, f_lo=80)
v *= db(-3.0) / np.max(np.abs(v))
hay = (np.abs(v) > db(-40)).astype(np.float32)
act = suaviza(np.pad(hay, (int(0.35 * SR), int(0.9 * SR))), 0.9)[:N]
act = np.minimum(1.0, act * 2.6)
act = suaviza(np.pad(act, (int(0.15 * SR), int(0.3 * SR))), 0.3)[:N]
duck = (1 - 0.66 * act).astype(np.float32)

# ------------------------------------------------------------------ música original (re mayor, 76 pulsos por minuto)
BPM = 76; BEAT = 60 / BPM; BAR = 4 * BEAT
ACORDES = [[50, 57, 62, 66, 69, 73], [47, 54, 59, 62, 66, 69], [43, 50, 55, 59, 62, 66], [45, 52, 57, 59, 64, 69]]
BAJO = [38, 35, 31, 33]
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
pad = np.zeros((N, 2), np.float32); arp = np.zeros((N, 2), np.float32); bajo = np.zeros(N, np.float32)
inten = [(0, .6), (S[2], .45), (S[3], .55), (S[4], .5), (S[5], .6), (S[6], .7), (S[7], .3), (S[8], .3), (S[9], .85), (DUR, .85)]
def intensidad(t): return float(np.interp(t, [p[0] for p in inten], [p[1] for p in inten]))
for b in range(int(np.ceil(DUR / (2 * BAR)))):
    t0 = b * 2 * BAR; ch = ACORDES[b % 4]; i0 = int(t0 * SR); L = min(int((2 * BAR + 1.6) * SR), N - i0)
    if L <= 0: break
    tt = np.arange(L) / SR
    envp = np.minimum(1, tt / 1.4) * np.minimum(1, np.maximum(0, (2 * BAR + 1.6 - tt) / 1.6))
    k = intensidad(t0)
    for j, m in enumerate(ch[:5]):
        f = hz(m)
        for canal, det in ((0, -0.0022), (1, 0.0022)):
            ph = rng.uniform(0, 6.28)
            s = np.sin(2 * np.pi * f * (1 + det) * tt + ph) + 0.33 * np.sin(2 * np.pi * 2 * f * (1 - det) * tt + ph * 1.7) + 0.12 * np.sin(2 * np.pi * 3 * f * tt + ph * 0.6)
            trem = 1 + 0.08 * np.sin(2 * np.pi * (0.13 + 0.02 * j) * tt + j)
            pad[i0:i0 + L, canal] += (s * envp * trem * (0.05 if j else 0.035)).astype(np.float32)
    lb = min(int(2 * BAR * SR) + int(0.3 * SR), N - i0); tb = np.arange(lb) / SR
    bajo[i0:i0 + lb] += (np.sin(2 * np.pi * hz(BAJO[b % 4]) * tb) * np.minimum(1, tb / 0.08) * np.exp(-tb / 4.5) * np.minimum(1, (2 * BAR + 0.3 - tb) / 0.3) * 0.20 * (0.5 + 0.5 * k)).astype(np.float32)
    patron = [0, 2, 4, 3, 5, 4, 2, 3, 1, 3, 4, 2, 5, 4, 3, 2]
    for q in range(16):
        tq = t0 + q * BEAT / 2
        if rng.random() > 0.25 + 0.6 * k and q % 4: continue
        m = ch[patron[(q + 3 * b) % 16]] + 12; f = hz(m); ln = int(1.5 * SR); tn = np.arange(ln) / SR
        nota = (np.sin(2 * np.pi * f * tn) + 0.42 * np.sin(2 * np.pi * 2 * f * tn) * np.exp(-tn / 0.12) + 0.2 * np.sin(2 * np.pi * 4.02 * f * tn) * np.exp(-tn / 0.05)) * np.exp(-tn / 0.42) * np.minimum(1, tn / 0.004)
        pon(arp, nota.astype(np.float32), tq + rng.normal(0, 0.004), 0.085 * (0.6 + 0.5 * k) * (1.0 if q % 4 == 0 else 0.72), pan=0.5 * np.sin(q * 1.3 + b))
ir_t = np.arange(int(2.2 * SR)) / SR
def rever(x, seed):
    ir = np.random.default_rng(seed).standard_normal(len(ir_t)).astype(np.float32) * np.exp(-ir_t / 0.55) * np.minimum(1, ir_t / 0.012); ir = filtro(ir, 250, 5200); ir /= np.sqrt(np.sum(ir ** 2))
    n = len(x) + len(ir) - 1; nf = 1 << int(np.ceil(np.log2(n)))
    return np.fft.irfft(np.fft.rfft(x, nf) * np.fft.rfft(ir, nf), nf)[:len(x)].astype(np.float32)
for c in (0, 1):
    arp[:, c] = arp[:, c] + 0.5 * rever(arp[:, c], 11 + c)
    pad[:, c] = filtro(pad[:, c] + 0.25 * rever(pad[:, c], 21 + c), 110, 3600)
bajo = filtro(bajo, 28, 220)
mus = pad + arp + bajo[:, None] * 0.8
mus *= curva([(0, 0), (0.4, 0.2), (2.5, 1), (DUR - 3.4, 1), (DUR - 0.3, 0), (DUR, 0)])[:, None]
mus *= curva([(p[0], 0.55 + 0.6 * p[1]) for p in inten])[:, None]
mus *= db(-22.5) / np.sqrt(np.mean(mus ** 2))

# ------------------------------------------------------------------ ambiente (ruido filtrado y zumbidos suaves, sin efectos de ciencia ficción)
def ruido_est(f_lo, f_hi, seed):
    r = np.random.default_rng(seed); o = np.zeros((N, 2), np.float32)
    for c in (0, 1):
        x = filtro(r.standard_normal(N).astype(np.float32), f_lo, f_hi); o[:, c] = x / (np.std(x) + 1e-9)
    return o
T = tm
rio = ruido_est(300, 2600, 1) * (1 + 0.15 * np.sin(2 * np.pi * 0.11 * t_all))[:, None].astype(np.float32)
agua = ruido_est(500, 6500, 2) * (1 + 0.1 * np.sin(2 * np.pi * 0.31 * t_all))[:, None].astype(np.float32)
zum = sum(a * np.sin(2 * np.pi * f * t_all + p) for f, a, p in ((60, 1.0, 0), (120, 0.5, 1), (180, 0.16, 2), (240, 0.06, 3))).astype(np.float32)
zum = (zum * (1 + 0.04 * np.sin(2 * np.pi * 0.9 * t_all)))[:, None].repeat(2, 1).astype(np.float32)
# niveles por escena: exterior (río), foso de la turbina (agua), sala de máquinas (zumbido)
g_rio = curva([(0, 1), (S[3], 1), (S[3] + 2, 0.15), (S[6], 0.15), (S[6] + 3, 0.9), (S[7] - 0.3, 0.9), (S[7] + 0.3, 0.05), (S[9] - 0.3, 0.05), (S[9] + 0.3, 1), (T['fin0'], 1), (T['fin0'] + 3, 0.5), (DUR, 0.5)])
g_agua = curva([(0, 0), (S[3] + 0.3, 0), (S[3] + 2.4, 1), (S[4], 1), (S[4] + 3.4, 0.25), (S[5] + 3, 0.2), (T['trafoX'] + 1.5, 0.05), (S[7] - 0.3, 0), (S[7] + 0.3, 1), (S[8] - 0.3, 1), (S[8] + 0.3, 0.2), (S[9] - 0.3, 0.2), (S[9] + 0.3, 0), (T['fin0'], 0), (T['fin0'] + 3, 0.4), (DUR, 0.4)])
g_zum = curva([(0, 0), (S[3] + 0.3, 0), (S[3] + 2.4, 0.35), (S[4], 0.4), (S[4] + 3.4, 1), (S[5] + 3, 0.8), (T['trafoX'] + 1.5, 0.9), (S[6], 0.9), (S[6] + 3.3, 0.1), (S[7] - 0.3, 0.05), (S[7] + 0.3, 0.4), (S[8] - 0.3, 0.4), (S[8] + 0.3, 1), (S[9] - 0.3, 1), (S[9] + 0.3, 0), (T['fin0'], 0), (T['fin0'] + 3, 0.5), (DUR, 0.5)])
fx = rio * g_rio[:, None] * db(-36) + agua * g_agua[:, None] * db(-33) + zum * g_zum[:, None] * db(-36)
# cierre del interruptor: golpe grave y corto
n = int(0.5 * SR); tt = np.arange(n) / SR
golpe = (np.sin(2 * np.pi * (52 * tt + 30 * 0.04 * (1 - np.exp(-tt / 0.04)))) * np.exp(-tt / 0.1) * 0.9 + filtro(rng.standard_normal(n).astype(np.float32), 150, 1200) * np.exp(-tt / 0.03) * 0.5).astype(np.float32)
pon(fx, golpe, T['close'], db(-17))
fx *= curva([(0, 0), (1.2, 1), (DUR - 2.5, 1), (DUR - 0.3, 0), (DUR, 0)])[:, None]

# ------------------------------------------------------------------ mezclas
def normaliza(x, nombre, objetivo):
    src, dst = os.path.join(ROOT, 'audio', nombre + SUF + '.wav'), os.path.join(ROOT, 'audio', nombre + SUF + '_final.wav')
    pico = np.max(np.abs(x)); escribe(src, x * min(1.0, db(-1.5) / pico))
    def mide(path, extra=''):
        r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', (extra + ',' if extra else '') + f'loudnorm=I={objetivo}:TP=-1.2:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace')
        return json.loads(r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1])
    m = mide(src)
    af = f"loudnorm=I={objetivo}:TP=-1.2:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-af', af, '-ar', str(SR), '-c:a', 'pcm_s16le', dst], check=True)
    os.remove(src)
    fin = mide(dst); mono = mide(dst, 'pan=mono|c0=0.5*c0+0.5*c1')
    return {'archivo': os.path.relpath(dst, ROOT).replace('\\', '/'), 'duracion_s': round(len(x) / SR, 3), 'lufs_integrado': float(fin['input_i']), 'pico_verdadero_dbtp': float(fin['input_tp']), 'rango_lra': float(fin['input_lra']), 'lufs_en_mono': float(mono['input_i'])}

vz = np.stack([v, v], 1)
con = normaliza(vz + mus * duck[:, None] + fx * (0.7 + 0.3 * duck[:, None]), 'mezcla', -16)
sin = normaliza(mus * 1.6 + fx * 1.4, 'sin_voz', -20)
rms = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
habla = act > 0.5
informe = {'con_voz': con, 'sin_voz': sin, 'reduccion_musica_bajo_voz_db': round(20 * np.log10(1 - 0.66), 1),
           'voz_menos_fondo_durante_la_locucion_db': round(float(rms(v[habla]) - rms(((mus * duck[:, None] + fx * (0.7 + 0.3 * duck[:, None])).mean(1))[habla])), 1),
           'voz': voz['voz'], 'palabras_por_minuto_solo_voz': voz['resumen']['ppm_solo_voz']}
json.dump(informe, open(os.path.join(ROOT, 'datos', 'audio_medicion' + SUF + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(informe, ensure_ascii=False, indent=1))
