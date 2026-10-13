# Comprobaciones técnicas y audiovisuales — Del agua a la electricidad

Fecha de producción: 12 de octubre de 2026. Equipo: Windows 11, Core i7-10750H, 64 GB, GeForce RTX 2070 Max-Q.

## 1. Inventario de herramientas y ruta elegida

| Herramienta | Estado | Observación |
|---|---|---|
| Blender / módulo `bpy` | No disponible | No está instalado ni en el PATH; no se instaló |
| Node.js 24.4.1 | Utilizable | Servidor estático, control del navegador por DevTools Protocol |
| Chrome 154 sin interfaz | Utilizable | WebGL2 sobre la GPU NVIDIA (ANGLE Direct3D 11); captura de fotogramas comprobada |
| ffmpeg / ffprobe 6.1.1 | Utilizable | libx264, AAC, loudnorm, ebur128, subtítulos con libass |
| Python 3.11.8 con numpy | Utilizable | Ensayos, mezcla de sonido, entregables |
| `edge-tts` 7.2.8 (voz neuronal en línea) | Instalado, no utilizable hoy | El servicio respondió 403 en todos los intentos; no se forzó el acceso |
| Voces de Windows (`System.Speech`): Sabina y Raul, es-MX | Utilizable | Se usó `Microsoft Sabina Desktop` |
| Three.js | No instalado | No se descargó: se reutilizó el renderizador WebGL2 propio ya probado en este equipo |
| Generación de imágenes | No usada | Toda la imagen es geometría y gráficos construidos por código |
| Otros servicios de voz (Azure, etc.) | No comprobado | |

Ruta: B (gráficos web), con renderizador propio en lugar de Three.js. Motivos: Blender no está disponible; el renderizador propio ya ofrece sombreado físico, sombras y captura determinista sin dependencias ni conexión; cada fotograma es función pura de su número.

## 2. Archivos de video verificados con ffprobe

| Archivo | Video | Audio | Duración | Fotogramas | Sonoridad / pico |
|---|---|---|---:|---:|---|
| `Central_hidroelectrica_3D_educativo_1080p.mp4` | H.264 High, 1920 × 1080, yuv420p, 30 fps constantes | AAC 48 kHz estéreo | 285,000 s | 8550 | −16,0 LUFS / −1,2 dBTP |
| `Central_hidroelectrica_3D_educativo_1080p_sin_voz.mp4` | igual | AAC 48 kHz estéreo | 285,000 s | 8550 | −20,0 LUFS / −5,5 dBTP |
| `Central_hidroelectrica_3D_educativo_1080p_subtitulado.mp4` | igual, recodificado con subtítulos incrustados | AAC 48 kHz estéreo | 285,000 s | 8550 | −16,0 LUFS / −1,2 dBTP |
| `Central_hidroelectrica_3D_educativo_2160p_master.mp4` | H.264 High, 3840 × 2160 renderizado a esa resolución (no ampliado), yuv420p, 30 fps constantes | AAC 48 kHz estéreo | 285,000 s | 8550 | −16,0 LUFS / −1,2 dBTP |

Los archivos se decodificaron completos con ffmpeg sin errores. El informe está en `datos/verificacion_video.json` del proyecto.

Duración: 4 min 45 s, el máximo previsto (4 min 30 s + 15 s). Se justifica por el ritmo de la voz disponible: 480 palabras a 128 palabras por minuto ocupan 224,6 s; las pausas suman 60 s.

## 3. Sincronía

- Voz: correlación cruzada entre el audio del MP4 y cada frase original, al inicio, a la mitad y al final: desfase de 0,0 ms en los tres puntos.
- Imagen: los rótulos y los cambios de plano se calculan a partir del instante medido de la palabra que los nombra (`datos/voz.json`); no hay tiempos puestos a mano contra el audio.
- Subtítulos: 86 entradas generadas desde los mismos tiempos, dos líneas como máximo.

## 4. Coherencia técnica comprobada

- P = ρ·g·Q·Hn·η = 1000 × 9,81 × 8,5 × 400 × 0,90 = 30,02 MW. Caudal para 20 MW: 5,66 m³/s; para 23 MW: 6,51 m³/s.
- n = 120·f/p = 120 × 60 / 20 = 360 rpm; el rodete y el rotor comparten eje y giro en el modelo.
- Las ondas del panel de tres fases y el brillo de las barras del estator usan la misma fase: diez ciclos eléctricos por vuelta del eje (20 polos).
- Ensayo de frecuencia: pendiente inicial simulada −0,856 Hz/s frente a −0,857 Hz/s teórica; desviación primaria estacionaria con D = 0: −0,300 Hz (teórica −0,300 Hz); con D = 1: −0,286 Hz (teórica −0,286 Hz); al reducir el paso a la mitad el mínimo no cambia.
- Ensayo de tensión: red de Thévenin de impedancia finita; al reducir el paso a la mitad el mínimo cambia menos de 0,001 kV.
- Las cifras de los rótulos se leen de los archivos de datos, no están escritas en la capa gráfica (salvo las que la locución pronuncia, fijadas en el guion).

## 5. Revisión de imagen

Método: imágenes a resolución completa de cada plano y de cada cambio de plano durante el desarrollo; hoja de contacto del video completo con un fotograma cada 3 s; fotogramas extraídos del MP4 final. Auditoría automática de rótulos en toda la línea de tiempo: máximo de cuatro elementos simultáneos (en los ensayos: panel de curvas, que cuenta doble, indicadores y un rótulo).

| Punto revisado | Resultado |
|---|---|
| Se reconoce la Pelton y cómo el chorro produce par | Cucharas dobles con divisor, seis inyectores tangenciales, chorro, flechas de desvío y de par |
| Rotor y estator diferenciados; tensión y corriente diferenciadas | Rotor gira, estator fijo en corte; «hay tensión; aún no hay corriente» con el interruptor abierto; las marcas de corriente aparecen al cerrar |
| Misma máquina entre escenas | Un solo modelo; los cortes ocultan piezas de ese modelo y se reensamblan |
| El agua no atraviesa sólidos y tiene descarga | El chorro termina en la cuchara; gotas hacia el foso; canal de restitución a presión atmosférica; sin tubo de aspiración |
| Niveles de tensión identificados | Transmisión 230 kV, subtransmisión 69 kV, media tensión 13,8 kV, baja tensión 120/240 V |
| Gobernador y AVR con funciones distintas | Ensayos separados y tarjeta de síntesis |
| Escalas simplificadas declaradas | «Esquema espacial simplificado», «Movimiento ralentizado», «Ondas ralentizadas», velocidad de reproducción de cada ensayo |
| Zona de subtítulos libre | Ningún gráfico por debajo de 930 px de 1080 |

## 6. Lo que no se pudo comprobar o no se hizo

1. La voz no es la prevista. Se usó una voz clásica de Windows (no neuronal), menos cálida y natural que la que pide el encargo. La voz neuronal en línea no estuvo disponible. El proyecto queda listo para cambiarla: ver «Cambiar la voz» en `LEEME.md`.
2. Nadie ha escuchado el audio. Se midieron sonoridad, pico verdadero y sincronía, pero la pronunciación («Pelton», cifras, entonación) y el equilibrio entre voz, música y ambiente no se han oído en altavoces. Conviene una escucha completa antes de difundirlo.
3. El video no se ha visto en reproducción continua. La revisión fue por fotogramas; no detecta, por ejemplo, un parpadeo breve entre dos fotogramas revisados.
4. Licencia de la voz: es una voz incluida con Windows. Para difusión pública o comercial hay que confirmar que los términos de Windows lo permiten, o sustituirla por una voz con licencia expresa.
5. El video de referencia no se consultó. La integración conceptual se tomó de la descripción del encargo; los créditos lo citan como referencia conceptual.
6. No se incluyó la curva P-Q (era opcional). El deflector del inyector está modelado pero no se anima ni se rotula; el ensayo es de aumento de carga, donde no actúa.
7. Estilo visual: geometría procedural con sombreado físico y sombras, de aspecto de maqueta limpia. No alcanza el realismo de un render de Blender con texturas y trazado de rayos.
