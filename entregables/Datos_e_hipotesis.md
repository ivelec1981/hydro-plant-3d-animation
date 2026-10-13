# Datos, parámetros e hipótesis — caso ilustrativo

Todos los valores proceden de `datos/parametros.json` (fuente única) y de `sim/ensayos.py`. No describen ninguna central real.

## Caso base

| Magnitud | Valor |
|---|---:|
| Salto bruto / pérdidas de conducción / salto neto | 412 m / 12 m / 400 m |
| Caudal de diseño | 8,5 m³/s |
| Eficiencia combinada turbina-generador | 0,90 |
| Potencia en bornes, P = ρ·g·Q·Hn·η | 30,02 MW |
| Caudal para 20 MW / 23 MW | 5,66 / 6,51 m³/s |
| Polos, velocidad sincrónica, frecuencia (n = 120·f/p) | 20, 360 rpm, 60 Hz |
| Presión estática equivalente al salto neto | 39,2 bar |
| Velocidad del chorro (coeficiente 0,97) | 85,9 m/s |
| Diámetro primitivo del rodete / diámetro del chorro (seis inyectores) | 2,10 m / 0,145 m |
| Corriente para 30 MW a 13,8 kV / 230 kV (factor de potencia 1) | 1255 A / 75,3 A |
| Niveles de tensión | 230 kV, 69 kV, 13,8 kV, 120/240 V |

Simplificaciones: eficiencia constante (una curva real varía con la carga); las pérdidas hidráulicas ya están descontadas en el salto neto; la geometría de la turbina (seis inyectores, 22 cucharas) y del generador es didáctica, no un diseño verificado; el modelo comprime alturas y distancias.

## Ensayo de frecuencia (sistema equivalente aislado)

Modelo: Una sola unidad en un sistema aislado; demanda de potencia constante con amortiguamiento D; turbina no lineal con columna de agua inelástica; regulador con estatismo permanente y transitorio, velocidad de aguja limitada; control secundario integral lento. Eficiencia constante.

| Parámetro | Valor |
|---|---:|
| Base | 30 MW |
| Constante de inercia H | 3,5 s (105,0 MJ) |
| Amortiguamiento de carga D | 1,0 pu/pu |
| Estatismo permanente / transitorio | 0,05 / 0,36 |
| Tiempo de reposición / del servomotor | 5,5 s / 0,2 s |
| Velocidad máxima de la aguja | 0,05 pu/s |
| Tiempo de arranque del agua Tw (tubería de 1100 m y 1,65 m) | 1,11 s |
| Control secundario: ganancia integral, retardo | 1,4 pu/s, 34 s |
| Evento | escalón de 20 a 23 MW en t = 10 s |
| Paso de integración (Runge-Kutta de orden 4) | 0.002 s |

Resultados: frecuencia mínima 58,06 Hz a los 3,7 s del evento; la potencia mecánica baja primero hasta 19,77 MW (efecto de la columna de agua); la frecuencia vuelve a ±0,02 Hz de 60 Hz a los 69,4 s; caudal final 6,51 m³/s.

Comprobaciones: pendiente inicial teórica -0,857 Hz/s, simulada -0,856 Hz/s; desviación estacionaria de la regulación primaria con D = 0: -0,300 Hz (teórica -0,300 Hz); con D = 1,0: -0,286 Hz (teórica -0,286 Hz); con la mitad del paso el mínimo cambia 0.0 Hz.

La caída de casi 2 Hz es propia de una unidad hidráulica sola y aislada con un escalón del 10 %: el estatismo transitorio hace que el regulador sea deliberadamente lento para respetar la inercia del agua. En un sistema interconectado la desviación sería mucho menor. El video lo indica en pantalla.

Tiempo de montaje: antes del evento × 1; primeros 4 s × 1/3; de 14 a 44 s × 3; de 44 a 100 s × 7. El reloj del ensayo y la velocidad de reproducción se muestran en el panel.

## Ensayo de tensión (red de impedancia finita)

Modelo: Generador de polos salientes, modelo de un eje (E'q); AVR estático de primer orden; red sin resistencias; carga reactiva de admitancia constante; potencia activa constante y ángulo de carga cuasiestático (sin oscilación electromecánica).

| Parámetro | Valor |
|---|---:|
| Base | 33,3 MVA |
| xd / xq / x'd | 1,00 / 0,65 / 0,30 pu |
| T'd0 | 5,0 s |
| Reactancia del transformador / de la red (Thévenin) | 0,10 / 0,30 pu |
| AVR: ganancia, constante de tiempo, techo de excitación | 200, 0,05 s, 3,2 pu |
| Potencia activa | 20 MW, constante |
| Evento | carga reactiva de 10 MVAr (admitancia constante) en el punto de conexión, t = 2 s |

Resultados: tensión en el punto de conexión 227,7 kV antes, mínimo 215,9 kV, 222,4 kV con AVR; con excitación fija bajaría hasta 211,3 kV. Potencia reactiva del generador 2,0 → 9,2 MVAr (límite ilustrativo a factor de potencia nominal: 14,5 MVAr). Corriente de campo 1,20 → 1,40 pu. La excitación alcanza su techo durante el transitorio.

Alcance: no se modela la oscilación electromecánica ni los limitadores de sobreexcitación; la curva P-Q completa no se muestra. Tiempo de montaje: × 1 antes del evento y × 1/40 durante 0,4 s.

## Archivos

`datos/ensayo_frecuencia.csv`, `datos/ensayo_tension.csv` (series), `datos/ensayos_resumen.json`, `datos/derivados.json`, `datos/parametros.json`. Para reproducir: `python sim/ensayos.py`.
