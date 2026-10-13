# Sintetiza la locución frase por frase y mide los tiempos reales.
#   python audio/tools/1_voz.py            sintetiza lo que falte y recalcula datos/voz.json
#   python audio/tools/1_voz.py --force    vuelve a sintetizar todo
# Motor según datos/guion.json -> voz.motor:
#   "sapi"      voz instalada en Windows (System.Speech), sin conexión
#   "edge-tts"  servicio en línea de Microsoft Edge (requiere que el servicio acepte la conexión)
#   "piper"     síntesis neuronal local (paquete piper-tts); "nombre" es el modelo, que se busca en
#               %LOCALAPPDATA%/piper-voices/<nombre>/<nombre>.onnx o en la ruta "modelo"; "velocidad" es
#               length_scale (1 = ritmo propio de la voz; mayor = más pausado)
# Salidas: audio/voz/eNN_k.wav (48 kHz mono, sin silencios en los extremos),
#          datos/voz.json (inicio y fin reales de cada frase, de cada corte de subtítulo y de cada palabra).
import asyncio, json, os, subprocess, sys, wave
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SUF = '_' + os.environ['IDIOMA'] if os.environ.get('IDIOMA') else ''          # IDIOMA=en usa guion_en.json y escribe voz_en
G = json.load(open(os.path.join(ROOT, 'datos', 'guion' + SUF + '.json'), encoding='utf-8'))
VOZ = os.path.join(ROOT, 'audio', 'voz' + SUF)
SR = 48000
FORCE = '--force' in sys.argv
MARGEN_FIN = 0.6    # silencio mínimo entre el fin de la locución y el fin de la escena
MOTOR = G['voz']['motor']
os.makedirs(VOZ, exist_ok=True)


async def edge(texto, mp3, meta, vel):
    import edge_tts
    com = edge_tts.Communicate(texto, G['voz']['nombre'], rate=vel, boundary='WordBoundary')
    palabras = []; pos = 0
    with open(mp3, 'wb') as f:
        async for ch in com.stream():
            if ch['type'] == 'audio':
                f.write(ch['data'])
            elif ch['type'] == 'WordBoundary':
                c = texto.find(ch['text'], pos); c = pos if c < 0 else c; pos = c + len(ch['text'])
                palabras.append({'t': ch['offset'] / 1e7, 'c': c, 'w': ch['text']})
    json.dump(palabras, open(meta, 'w', encoding='utf-8'), ensure_ascii=False)


def sapi(lote):
    f = os.path.join(VOZ, '_lote.json')
    json.dump(lote, open(f, 'w', encoding='utf-8'), ensure_ascii=False)
    subprocess.run(['pwsh', '-NoProfile', '-File', os.path.join(os.path.dirname(__file__), 'sapi.ps1'), '-Lote', f, '-Voz', G['voz']['nombre']], check=True)
    os.remove(f)


def piper_lote(lote):
    """Sintetiza con Piper y estima el instante de cada palabra.
    Piper no entrega tiempos de palabra sin el paquete onnx; se estiman así: las pausas más largas del
    audio se asignan a los signos de puntuación internos y, dentro de cada tramo, las palabras se
    reparten en proporción a su número de letras."""
    from piper import PiperVoice, SynthesisConfig
    nombre = G['voz']['nombre']
    modelo = G['voz'].get('modelo') or os.path.join(os.environ['LOCALAPPDATA'], 'piper-voices', nombre, nombre + '.onnx')
    voz = PiperVoice.load(modelo)
    for it in lote:
        trozos = list(voz.synthesize(it['texto'], SynthesisConfig(length_scale=float(it['velocidad']))))
        sr = trozos[0].sample_rate; x = np.concatenate([c.audio_int16_array for c in trozos])
        with wave.open(it['wav'], 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(x.astype(np.int16).tobytes())
        y = np.abs(x.astype(np.float32)) / 32768.0
        k = int(0.02 * sr); env = np.convolve(y, np.ones(k) / k, 'same'); voz_on = env > max(0.012, 0.04 * env.max())
        idx = np.where(voz_on)[0]; a, b = idx[0], idx[-1]
        # pausas internas (silencios de 90 ms o más), como (inicio, fin) en muestras
        pausas = []; i = a
        while i < b:
            if not voz_on[i]:
                j = i
                while j < b and not voz_on[j]: j += 1
                if j - i >= 0.09 * sr: pausas.append((i, j))
                i = j
            else: i += 1
        # palabras con su posición de carácter; un tramo termina en cada palabra seguida de , ; :
        pal = []; pos = 0
        for tok in it['texto'].split(' '):
            if tok.strip(): pal.append({'c': pos, 'w': tok.strip('¿?¡!.,;:«»"'), 'corte': tok[-1] in ',;:'})
            pos += len(tok) + 1
        # posición proporcional de cada palabra (por letras) y anclas en las pausas que caen cerca de un signo
        pesos = np.array([len(q['w']) + 1.5 for q in pal]); u = np.concatenate([[0.0], np.cumsum(pesos)]) / pesos.sum()   # u[n] = inicio de la palabra n
        ax, ay = [0.0], [float(a)]; libre = a
        for n, q in enumerate(pal[:-1]):
            if not q['corte']: continue
            esperado = a + (b - a) * u[n + 1]
            cand = [z for z in pausas if z[0] > libre and abs((z[0] + z[1]) / 2 - esperado) < 0.16 * (b - a)]
            if not cand: continue
            z = max(cand, key=lambda z: z[1] - z[0]); libre = z[1]
            ax += [u[n + 1] - 1e-6, u[n + 1]]; ay += [float(z[0]), float(z[1])]
        ax.append(1.0); ay.append(float(b))
        salida = [{'t': round(float(np.interp(u[n], ax, ay)) / sr, 4), 'c': q['c'], 'w': q['w']} for n, q in enumerate(pal)]
        json.dump(salida, open(it['meta'], 'w', encoding='utf-8'), ensure_ascii=False)


def lee_wav(path):
    with wave.open(path, 'rb') as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0


def escribe_wav(path, x):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def main():
    # 1) qué frases hay que sintetizar
    pend = []
    for e in G['escenas']:
        for k, fr in enumerate(e['voz']):
            base = os.path.join(VOZ, f"e{e['n']:02d}_{k + 1}")
            tts = fr['tts'].replace('|', ' ')
            vel = str(fr.get('velocidad', e.get('velocidad', G['voz']['velocidad'])))
            firma = tts + '#' + MOTOR + '#' + G['voz']['nombre'] + vel
            previo = open(base + '.txt', encoding='utf-8').read() if os.path.exists(base + '.txt') else None
            if FORCE or previo != firma or not os.path.exists(base + '.wav'):
                pend.append((base, tts, vel, firma))
    if pend:
        if MOTOR == 'sapi':
            sapi([{'texto': t, 'wav': b + '_src.wav', 'meta': b + '.json', 'velocidad': int(v)} for b, t, v, _ in pend])
        elif MOTOR == 'piper':
            piper_lote([{'texto': t, 'wav': b + '_src.wav', 'meta': b + '.json', 'velocidad': v} for b, t, v, _ in pend])
        else:
            for b, t, v, _ in pend:
                asyncio.run(edge(t, b + '_src.mp3', b + '.json', v))
        for b, t, v, firma in pend:
            src = b + ('_src.mp3' if MOTOR == 'edge-tts' else '_src.wav'); raw = b + '_raw.wav'
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-ar', str(SR), '-af', 'aresample=resampler=soxr' if False else 'anull', raw], check=True)
            x = lee_wav(raw); os.remove(raw); os.remove(src)
            # recorta el silencio de los extremos (umbral -45 dB) y deja unos milisegundos de aire
            idx = np.where(np.abs(x) > 10 ** (-45 / 20))[0]
            a = max(0, idx[0] - int(0.025 * SR)); c = min(len(x), idx[-1] + int(0.06 * SR))
            x = x[a:c]
            fade = int(0.01 * SR)
            x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade)
            escribe_wav(b + '.wav', x)
            pal = json.load(open(b + '.json', encoding='utf-8-sig'))
            for p in pal:
                p['t'] = round(max(0.0, p['t'] - a / SR), 4)
            json.dump({'recorte': a / SR, 'palabras': pal}, open(b + '.json', 'w', encoding='utf-8'), ensure_ascii=False)
            open(b + '.txt', 'w', encoding='utf-8').write(firma)
            print('sintetizada', os.path.basename(b))

    # 2) tiempos
    salida = {'voz': G['voz'], 'escenas': []}
    problemas = []; total_pal = 0; total_dur = 0.0
    for e in G['escenas']:
        t = None; frases = []
        for k, fr in enumerate(e['voz']):
            base = os.path.join(VOZ, f"e{e['n']:02d}_{k + 1}")
            dur = len(lee_wav(base + '.wav')) / SR
            pal = json.load(open(base + '.json', encoding='utf-8'))['palabras']
            ini = e['ini'] + fr['en'] if 'en' in fr else t + fr.get('pausa', 0.6)
            if t is not None and ini < t + 0.25: problemas.append(f"escena {e['n']:02d}, frase {k + 1}: empieza {t + 0.25 - ini:.2f} s antes de que termine la anterior")
            fin = ini + dur
            # cortes de subtítulo: instante de la primera palabra de cada parte (por posición de carácter)
            partes_sub = fr['sub'].split('|'); partes_tts = fr['tts'].split('|')
            assert len(partes_sub) == len(partes_tts), (e['n'], k)
            cortes = []; car = 0
            for j, (ps, pt) in enumerate(zip(partes_sub, partes_tts)):
                if j == 0: t0 = ini
                else:
                    w = next((p for p in pal if p['c'] >= car - 1), None)
                    t0 = ini + (w['t'] if w else dur)
                cortes.append({'ini': round(max(ini, t0 - 0.08), 3), 'texto': ps.strip()})
                car += len(pt) + 1
            for a, b in zip(cortes, cortes[1:] + [{'ini': fin}]):
                a['fin'] = round(b['ini'], 3)
            assert all(c['fin'] - c['ini'] > 0.4 for c in cortes), (e['n'], k, cortes)
            npal = len(fr['tts'].replace('|', ' ').split())
            total_pal += npal; total_dur += dur
            frases.append({'archivo': os.path.relpath(base + '.wav', ROOT).replace('\\', '/'), 'ini': round(ini, 3), 'fin': round(fin, 3), 'dur': round(dur, 3),
                           'ppm': round(npal / dur * 60), 'cortes': cortes, 'palabras': [[round(ini + w['t'], 3), w['w']] for w in pal]})
            t = fin
        holgura = e['fin'] - t
        if holgura < MARGEN_FIN:
            problemas.append(f"escena {e['n']:02d}: la voz termina {(-holgura):+.2f} s respecto al fin de la escena")
        salida['escenas'].append({'n': e['n'], 'ini': e['ini'], 'fin': e['fin'], 'holgura': round(holgura, 2), 'frases': frases})
        print(f"escena {e['n']:02d}  {e['ini']:>3}-{e['fin']:<3}  voz hasta {t:7.2f}  holgura {holgura:5.2f} s  " + ' '.join(f"[{f['ini'] - e['ini']:.1f}-{f['fin'] - e['ini']:.1f}|{f['ppm']}ppm]" for f in frases))
    pausas = sum(len(e['frases']) - 1 for e in salida['escenas'])
    salida['resumen'] = {'palabras': total_pal, 'segundos_de_voz': round(total_dur, 1), 'ppm_solo_voz': round(total_pal / total_dur * 60),
                         'ppm_con_pausas_entre_frases': round(total_pal / (total_dur + 0.7 * pausas) * 60)}
    json.dump(salida, open(os.path.join(ROOT, 'datos', 'voz' + SUF + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(salida['resumen'])
    for p in problemas:
        print('PROBLEMA:', p)
    sys.exit(1 if problemas else 0)


main()
