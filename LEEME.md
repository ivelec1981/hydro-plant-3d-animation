# Del agua a la electricidad — archivos fuente

Proyecto editable del video educativo de una central hidroeléctrica con turbina Pelton y generador síncrono (285 s, 30 fps). Todo es código y datos: no hay modelos, imágenes, música ni grabaciones de terceros.

## Requisitos

Node 22 o superior, Chrome o Edge, `ffmpeg` y `ffprobe` en el PATH, Python 3.11 con `numpy`. Sin dependencias de npm ni recursos en línea: el proyecto funciona sin conexión.

La voz se sintetiza con una voz instalada en Windows (`Microsoft Sabina Desktop`, es-MX) mediante PowerShell 7 y `System.Speech`. Para usar otra voz, ver «Cambiar la voz».

## Reproducir

Ejecutar desde esta carpeta, en este orden:

```
python sim/ensayos.py                        # cálculos y ensayos -> datos/derivados.json, ensayo_*.csv, series_web.json
python audio/tools/1_voz.py                  # locución frase por frase y tiempos medidos -> datos/voz.json
node render/render.mjs --audit               # rótulos simultáneos por escena
node render/render.mjs --quiet --eval "JSON.stringify({S: T.S, close: T.close, fin0: T.fin0, trafoX: T.trafoX, path0: T.path0, path1: T.path1, ensayo_frecuencia: T.f, ensayo_tension: T.v, fotogramas: N_FRAMES})" > datos/tiempos.json
node render/render_todo.mjs --scale 0.5 --crf 23 --preset veryfast --out salida/previo_540p.mp4    # preliminar
python audio/tools/2_mezcla.py               # ambiente y música sintetizados, mezcla, -16 LUFS
python audio/tools/3_entregables.py          # SRT, narración, storyboard, datos e hipótesis
node render/render_todo.mjs --scale 1 --crf 17 --preset slow --out salida/imagen_1080p30.mp4       # imagen final, 1920 x 1080 nativo
node render/render_todo.mjs --scale 2 --crf 17 --preset medium --out salida/imagen_2160p30.mp4     # opcional: 3840 x 2160 nativo
python audio/tools/4_union.py                # une imagen y sonido, copia subtitulada, verificación con ffprobe
```

Los archivos `salida/imagen_*.mp4` (imagen sin sonido) son intermedios; pueden borrarse después de la unión y los comandos de render los regeneran. El render escribe los tramos en la carpeta temporal del sistema, fuera de OneDrive, y es reanudable.

Imágenes sueltas: `node render/render.mjs --stills 1680,2700,6000` (números de fotograma) las deja en `salida/stills`.

Vista interactiva: servir esta carpeta con cualquier servidor estático y abrir `web/index.html` (`?f=3000` abre en un fotograma). Muestra los subtítulos y permite recorrer la línea de tiempo.

## Estructura

| Ruta | Función |
|---|---|
| `datos/parametros.json` | Fuente única de parámetros del caso ilustrativo y de los dos ensayos |
| `sim/ensayos.py` | Magnitudes derivadas, ensayo de frecuencia (sistema aislado) y ensayo de tensión (red de Thévenin), con comprobaciones |
| `datos/guion.json` | Guion por escena: límites, texto de subtítulos y texto enviado al sintetizador |
| `datos/voz.json` | Tiempos medidos de cada frase, corte de subtítulo y palabra |
| `web/layout.js` | Disposición espacial común: turbina, generador, corredor eléctrico, función de altura del terreno |
| `web/terreno.js` | Terreno, lago, río, presa, toma, tubería de presión, muelle, árboles |
| `web/central.js` | Casa de máquinas con corte, distribuidor, inyectores, rodete Pelton, eje, generador con sector desmontable, gabinetes de control |
| `web/red.js` | Barras, interruptor, transformadores, patio de 230 kV, torres, subestaciones, postes, transformador de distribución, viviendas |
| `web/tiempos.js` | Instantes con nombre, ligados a la palabra de la locución que los nombra; escalas de tiempo de los ensayos |
| `web/escena.js` | Estado del modelo en función del tiempo: cortes, giros, chorros, gotas, marcas de flujo, resaltes |
| `web/camaras.js` | Plan de cámara |
| `web/hud.js`, `web/style.css` | Rótulos, tarjetas, gráficos de los ensayos, créditos (capas vectoriales con tipografía real) |
| `web/engine.js` | Renderizador WebGL2 propio: sombreado físico, sombras, agua, cielo, plano de corte, transparencia por pieza |
| `render/` | Captura por DevTools Protocol, render en paralelo reanudable |
| `audio/tools/` | Voz, ambiente y música, mezcla, entregables, unión y verificación |

Cada fotograma es una función pura de su número (`t = fotograma / 30`): cualquier tramo se puede renderizar de forma independiente y el resultado es idéntico al de un render secuencial.

## Cambiar la voz

En `datos/guion.json`, campo `voz`:

- `{"motor": "sapi", "nombre": "<voz instalada en Windows>", "velocidad": "-2"}`: voces de `System.Speech` (velocidad entera de -10 a 10).
- `{"motor": "piper", "nombre": "en_US-ryan-high", "velocidad": "1.32"}`: voz neuronal local de Piper; `velocidad` es `length_scale` (mayor = más pausado). Hay modelos en español (por ejemplo `es_MX-claude-high`); revisar la licencia de cada uno en su ficha.
- `{"motor": "edge-tts", "nombre": "es-EC-AndreaNeural", "velocidad": "-10%"}`: voz neuronal en línea mediante el paquete `edge-tts`. El 12 de octubre de 2026 el servicio rechazaba la conexión (error 403), por lo que no se usó.

Después de cambiarla, repetir todos los pasos desde `1_voz.py`. Si la voz dura más, `1_voz.py` avisa de las escenas que se quedan sin holgura; se ajustan `ini`, `fin`, `en` y `pausa` en el guion. Las imágenes siguen a las palabras, de modo que no hay que tocar la animación.

## Versión en inglés

La narración en inglés está en `audio/tools/0_guion_en.py` (misma división en frases que el guion en español; cada frase empieza en el mismo instante que su equivalente, así que los límites de escena y el montaje no cambian). Los textos en pantalla se traducen con `web/textos.js`, y `web/tiempos.js` indica qué palabra inglesa hace de ancla de cada rótulo.

Voz: `en_US-ryan-high` de Piper (síntesis neuronal local, paquete `piper-tts`). El modelo (120 MB) no está en esta carpeta: se descarga una vez con `python -m piper.download_voices en_US-ryan-high --data-dir "%LOCALAPPDATA%\piper-voices\en_US-ryan-high"`. Su ficha indica que se entrenó con RyanSpeech, con licencia CC BY-NC-SA 4.0: uso no comercial. Piper no entrega el instante de cada palabra sin el paquete `onnx`; `1_voz.py` lo estima a partir de las pausas y de la longitud de las palabras (error típico de unas décimas de segundo).

```
python audio/tools/0_guion_en.py             # datos/guion_en.json
IDIOMA=en python audio/tools/1_voz.py        # audio/voz_en y datos/voz_en.json
node render/render.mjs --quiet --lang en --eval "JSON.stringify({S: T.S, close: T.close, fin0: T.fin0, trafoX: T.trafoX, path0: T.path0, path1: T.path1, ensayo_frecuencia: T.f, ensayo_tension: T.v, fotogramas: N_FRAMES})" > datos/tiempos_en.json
node render/render_todo.mjs --lang en --scale 1 --crf 17 --preset slow --out salida/imagen_1080p30_en.mp4
IDIOMA=en python audio/tools/2_mezcla.py     # audio/mezcla_en_final.wav
python audio/tools/5_version_en.py           # Subtitles_en.srt, Narration_en.txt, MP4 en inglés y verificación
```

Copias para redes: `python audio/tools/6_corte_en.py` genera el video completo en inglés con subtítulos incrustados y un corte de 89 s (tramos del video completo unidos con fundidos, con su propia mezcla y sus subtítulos). Los tramos se eligen en la lista `TRAMOS` del script; cada uno debe contener frases enteras. Con `--solo-corte` no rehace la copia subtitulada del video completo.

El corte incluye un tramo propio de 24 s, «el estator no gira; su campo sí» (`web/clip_campo.js`, narración en `datos/guion_campo_en.json`): corrientes de las tres fases, contribución pulsante de cada fase sobre su eje fijo y resultante giratoria de amplitud constante, más la onda fundamental del estator sobre el corte del generador. La suma se comprueba en `sim/campo_trifasico.py` (`datos/campo_trifasico.json`). Para regenerarlo:

```
python sim/campo_trifasico.py
IDIOMA=campo_en python audio/tools/1_voz.py
node render/render.mjs --quiet --lang en --clip campo --crf 17 --preset slow --out salida/clip_campo_en.mp4
python audio/tools/6_corte_en.py --solo-corte
```

En PowerShell, `IDIOMA=en` se escribe `$env:IDIOMA = 'en'` antes del comando (y `Remove-Item Env:IDIOMA` después). Vista interactiva en inglés: `web/index.html?lang=en`.

## Cambiar parámetros

Editar `datos/parametros.json` y repetir todos los pasos. Los rótulos numéricos, las tarjetas, los gráficos, el movimiento de la aguja y el caudal leen esos datos. Las cifras que la locución pronuncia (400 m, 8,5 m³/s, 30 MW, 20 polos, 360 rpm, 20 a 23 MW) están escritas en el guion y deben cambiarse allí a la vez.
