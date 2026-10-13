# Genera los entregables escritos a partir de los mismos datos que usa el video:
#   entregables/Subtitulos_es.srt, Narracion_es.txt, Storyboard_con_tiempos.md, Datos_e_hipotesis.md
#   python audio/tools/3_entregables.py
import json, os, shutil, textwrap

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'entregables')
os.makedirs(OUT, exist_ok=True)
J = lambda n: json.load(open(os.path.join(ROOT, 'datos', n + '.json'), encoding='utf-8'))
G, V, T, P, D, E = J('guion'), J('voz'), J('tiempos'), J('parametros'), J('derivados'), J('ensayos_resumen')
S = T['S']
c = lambda x, d=1: f"{x:.{d}f}".replace('.', ',')


def tc(t, srt=False):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}" if srt else f"{m:02d}:{s:02d},{ms // 100}"
def mmss(t): return f"{int(t) // 60:02d}:{int(t) % 60:02d}"

# ---------------------------------------------------------------- SRT (tiempos del audio real, dos líneas como máximo)
n = 0; srt = []
for e in V['escenas']:
    for f in e['frases']:
        for k in f['cortes']:
            n += 1
            tx = k['texto']; lineas = [tx]
            if len(tx) > 42:                       # dos líneas equilibradas: corte en el espacio más cercano al centro
                esp = [i for i, ch in enumerate(tx) if ch == ' ']; i = min(esp, key=lambda j: abs(j - len(tx) / 2)); lineas = [tx[:i], tx[i + 1:]]
            assert max(map(len, lineas)) <= 46, tx
            srt.append(f"{n}\n{tc(k['ini'], True)} --> {tc(max(k['fin'] - 0.04, k['ini'] + 0.5), True)}\n" + "\n".join(lineas) + "\n")
open(os.path.join(OUT, 'Subtitulos_es.srt'), 'w', encoding='utf-8-sig', newline='\r\n').write("\n".join(srt))

# ---------------------------------------------------------------- narración
g = [f"{G['titulo']} — narración", "",
     f"Voz: {V['voz']['nombre']} ({V['voz'].get('idioma', '')}), síntesis local de Windows, una frase por archivo.",
     f"{V['resumen']['palabras']} palabras; {c(V['resumen']['segundos_de_voz'])} s de voz; {V['resumen']['ppm_solo_voz']} palabras por minuto sin contar pausas.",
     "Los tiempos son los medidos en el audio final (minutos:segundos,décimas).", ""]
for e, ev in zip(G['escenas'], V['escenas']):
    g.append(f"Escena {e['n']} — {mmss(e['ini'])} a {mmss(e['fin'])} — {e['titulo']}")
    for fr, fv in zip(e['voz'], ev['frases']):
        g.append(f"  [{tc(fv['ini'])} – {tc(fv['fin'])}]  {fr['sub'].replace('|', ' ')}")
    g.append("")
open(os.path.join(OUT, 'Narracion_es.txt'), 'w', encoding='utf-8').write("\n".join(g))

# ---------------------------------------------------------------- storyboard
fr, te = T['ensayo_frecuencia'], T['ensayo_tension']
H = {
 1: [(0.0, 'Reservorio, presa y tubería; la cámara abre hacia el panorama completo. Título «Del agua a la electricidad».'), (T['path0'], 'Recorrido luminoso conceptual: azul (hidráulica), ámbar (mecánica), verde (eléctrica). Rótulos de los tres dominios.'), (9.8, 'Plano estable del sistema completo. Rótulo «Esquema espacial simplificado».')],
 2: [(S[2] + 2.8, 'Plano medio de reservorio, presa, conducción y casa de máquinas. Cota de salto bruto (412 m).'), (S[2] + 7, 'Pérdidas en la conducción (12 m) y salto neto (400 m). Rótulo «Caso ilustrativo».'), (S[2] + 16, 'La cámara baja por la tubería. Marcas azules de caudal; rótulo «Caudal de diseño: 8,5 m³/s».'), (S[2] + 19.5, 'Tarjeta de potencia: P = ρ·g·Q·Hn·η ≈ 30,0 MW; η = 0,90.'), (S[2] + 24.2, 'Rótulo «Presión antes de la boquilla ≈ 39 bar. El agua conserva su presión en la tubería».')],
 3: [(S[3] + 0.4, 'Se retiran la fachada y el muro frontal del foso (corte). Rótulo «Movimiento ralentizado para explicación · velocidad real: 360 rpm».'), (S[3] + 2.3, 'Foso de la turbina: distribuidor, seis inyectores, rodete Pelton de eje vertical. Corte del inyector de referencia: aguja y boquilla.'), (S[3] + 9.3, 'Detalle del chorro sobre las cucharas dobles: flechas de entrada y de las dos mitades desviadas.'), (S[3] + 16, 'Flecha ámbar de par sobre el rodete. Pausa de observación de 3 s.'), (S[3] + 22, 'Plano medio: eje hacia el generador y descarga al canal de restitución, a presión atmosférica.')],
 4: [(S[4] + 0.1, 'La cámara sube por el eje. Se retira el sector frontal de carcasa y estator.'), (S[4] + 2.4, 'Rotor de polos salientes (20 polos) con bobinas de campo en cobre.'), (S[4] + 7.2, 'Lazos violetas de flujo, conceptuales, que giran con el rotor.'), (S[4] + 11.8, 'Estator: núcleo, barras por fase y cabezas de bobina; permanece fijo.'), (S[4] + 15, 'Detalle del entrehierro en el borde del corte.'), (S[4] + 20.4, 'Panel de tres tensiones desfasadas 120° (ralentizadas); las barras del estator cambian de brillo con la misma fase.'), (S[4] + 25.2, 'f = polos × rpm / 120 → 20 × 360 / 120 = 60 Hz. Rótulo «Interruptor abierto: hay tensión; aún no hay corriente hacia la red».')],
 5: [(S[5] + 0.2, 'El sector retirado vuelve a su sitio (reensamble).'), (S[5] + 3.0, 'Plano de generador, barras, interruptor y transformador. Panel «Antes de conectar»: fasores de generador y red; se marcan tensión, frecuencia, ángulo y secuencia.'), (T['close'], 'Cierre del interruptor. Aparecen las marcas de corriente; potencia entregada 0 → 30 MW. Flechas de par hidráulico y par electromagnético opuesto.'), (T['trafoX'] + 1.6, 'Transformador elevador: se retira el panel frontal del tanque; núcleo y devanados. Rótulos 13,8 kV y 230 kV; «Eleva tensión; no crea energía».'), (S[5] + 22.2, 'Tarjeta «Misma potencia, menor corriente»: ≈ 1255 A a 13,8 kV, ≈ 75 A a 230 kV.')],
 6: [(S[6] + 0.2, 'Se cierran los cortes. Línea de 230 kV con tres torres. Franja de niveles de tensión.'), (S[6] + 5.9, 'Subestación reductora 230/69 kV.'), (S[6] + 10.8, 'Subtransmisión a 69 kV y subestación 69/13,8 kV.'), (S[6] + 15.4, 'Alimentador de media tensión; transformador de distribución monofásico (7,97 kV fase-neutro → 120/240 V); acometida de dos fases y neutro.'), (S[6] + 22.5, 'Vista esquemática de todos los niveles; resalte de equipos de maniobra, medición y protección.')],
 7: [(S[7] + 0.15, 'Transición «Ensayo ilustrativo · Respuesta de frecuencia · Sistema equivalente aislado».'), (fr['t0'], 'Inyector en corte (aguja, servomotor) y panel de curvas: demanda, potencia mecánica y frecuencia, con cursor y reloj del ensayo. Reproducción × 1.'), (fr['ev'], 'Escalón de demanda 20 → 23 MW. Reproducción × 1/3: caída de frecuencia; la potencia mecánica baja primero (inercia del agua).'), (fr['a'], 'Reproducción × 3: regulación primaria; la aguja abre, el caudal sube de 5,66 a ≈ 6,5 m³/s.'), (fr['b'], 'Reproducción × 7: regulación secundaria; la frecuencia vuelve a 60 Hz.')],
 8: [(S[8] + 0.15, 'Transición «Ensayo ilustrativo · Respuesta de tensión · Conectado a una red de impedancia finita».'), (te['t0'], 'Generador en corte, gabinete del AVR y panel: unifilar, tensión en el punto de conexión (con y sin AVR), potencia reactiva y corriente de campo.'), (te['ev'], 'Escalón de carga reactiva de 10 MVAr. Reproducción × 1/40: la tensión cae y el AVR aumenta la excitación.'), (S[8] + 22.4, 'Línea de límite de potencia reactiva a factor de potencia nominal (14,5 MVAr).'), (S[8] + 27, 'Tarjeta: gobernador → agua → potencia activa y frecuencia; AVR → excitación → tensión y potencia reactiva.')],
 9: [(S[9], 'Panorama completo con el recorrido luminoso. Frases «El agua aporta energía», «La máquina la transforma», «Los controles permiten operar».'), (T['fin0'], 'Última imagen: turbina, generador, transformador y red unidos, con los cortes abiertos y las marcas de corriente.'), (T['fin0'] + 3.8, 'Créditos y nota «Modelo educativo; parámetros ilustrativos». Fundido a negro.')],
}
sb = [f"# Storyboard con tiempos — {G['titulo']}\n", f"Duración total: {mmss(S[10])} ({S[10]:.0f} s), 30 fotogramas por segundo. Los instantes proceden de `datos/tiempos.json` y `datos/voz.json`.\n"]
for e in G['escenas']:
    sb.append(f"\n## Escena {e['n']} — {mmss(e['ini'])} a {mmss(e['fin'])} — {e['titulo']}\n")
    sb.append(f"Idea de aprendizaje: {e['aprendizaje']}\n")
    sb.append("| Tiempo | Imagen |\n|---|---|")
    for t, d in H[e['n']]: sb.append(f"| {mmss(t)} | {d} |")
    sb.append("\nNarración: «" + " ".join(f['sub'].replace('|', ' ') for f in e['voz']) + "»")
open(os.path.join(OUT, 'Storyboard_con_tiempos.md'), 'w', encoding='utf-8').write("\n".join(sb) + "\n")

# ---------------------------------------------------------------- datos e hipótesis
h, m, r = P['hidraulica'], P['maquina'], P['red']
F, Fr, Fc = E['ensayo_frecuencia']['parametros'], E['ensayo_frecuencia']['resultados'], E['ensayo_frecuencia']['comprobaciones']
Vp, Vr = E['ensayo_tension']['parametros'], E['ensayo_tension']['resultados']
d = f"""# Datos, parámetros e hipótesis — caso ilustrativo

Todos los valores proceden de `datos/parametros.json` (fuente única) y de `sim/ensayos.py`. No describen ninguna central real.

## Caso base

| Magnitud | Valor |
|---|---:|
| Salto bruto / pérdidas de conducción / salto neto | {h['salto_bruto_m']} m / {h['perdidas_conduccion_m']} m / {h['salto_neto_m']} m |
| Caudal de diseño | {c(h['caudal_diseno_m3_s'])} m³/s |
| Eficiencia combinada turbina-generador | {c(h['eficiencia_turbina_generador'], 2)} |
| Potencia en bornes, P = ρ·g·Q·Hn·η | {c(D['potencia_diseno_MW'], 2)} MW |
| Caudal para 20 MW / 23 MW | {c(D['caudal_20MW_m3_s'], 2)} / {c(D['caudal_23MW_m3_s'], 2)} m³/s |
| Polos, velocidad sincrónica, frecuencia (n = 120·f/p) | {m['polos']}, {D['velocidad_sincronica_rpm']:.0f} rpm, {m['frecuencia_Hz']} Hz |
| Presión estática equivalente al salto neto | {c(D['presion_estatica_en_boquilla_bar'])} bar |
| Velocidad del chorro (coeficiente {c(h['coef_velocidad_boquilla'], 2)}) | {c(D['velocidad_chorro_m_s'])} m/s |
| Diámetro primitivo del rodete / diámetro del chorro (seis inyectores) | {c(D['diametro_primitivo_rodete_m'], 2)} m / {c(D['diametro_chorro_m'], 3)} m |
| Corriente para 30 MW a 13,8 kV / 230 kV (factor de potencia 1) | {D['corriente_30MW_13_8kV_A']} A / {c(D['corriente_30MW_230kV_A'])} A |
| Niveles de tensión | {r['transmision_kV']} kV, {r['subtransmision_kV']} kV, {c(r['media_tension_kV'])} kV, 120/240 V |

Simplificaciones: eficiencia constante (una curva real varía con la carga); las pérdidas hidráulicas ya están descontadas en el salto neto; la geometría de la turbina (seis inyectores, {D['cucharas_estimadas']} cucharas) y del generador es didáctica, no un diseño verificado; el modelo comprime alturas y distancias.

## Ensayo de frecuencia (sistema equivalente aislado)

Modelo: {E['ensayo_frecuencia']['hipotesis']}

| Parámetro | Valor |
|---|---:|
| Base | {F['base_MW']} MW |
| Constante de inercia H | {c(F['H_s'])} s ({c(Fc['energia_cinetica_MJ'])} MJ) |
| Amortiguamiento de carga D | {c(F['D_pu'])} pu/pu |
| Estatismo permanente / transitorio | {c(F['estatismo_permanente'], 2)} / {c(F['estatismo_transitorio'], 2)} |
| Tiempo de reposición / del servomotor | {c(F['T_reposicion_s'])} s / {c(F['T_servo_s'])} s |
| Velocidad máxima de la aguja | {c(F['velocidad_max_aguja_pu_s'], 2)} pu/s |
| Tiempo de arranque del agua Tw (tubería de {h['tuberia_longitud_m']} m y {c(h['tuberia_diametro_m'], 2)} m) | {c(Fc['tiempo_arranque_agua_Tw_s'], 2)} s |
| Control secundario: ganancia integral, retardo | {c(F['secundaria_Ki_pu_s'])} pu/s, {F['secundaria_retardo_s']} s |
| Evento | escalón de {m['despacho_inicial_MW']} a {m['demanda_final_MW']} MW en t = {F['t_evento_s']} s |
| Paso de integración (Runge-Kutta de orden 4) | {F['dt_s']} s |

Resultados: frecuencia mínima {c(Fr['nadir_Hz'], 2)} Hz a los {c(Fr['t_nadir_desde_evento_s'])} s del evento; la potencia mecánica baja primero hasta {c(Fr['Pm_min_tras_evento_MW'], 2)} MW (efecto de la columna de agua); la frecuencia vuelve a ±0,02 Hz de 60 Hz a los {c(Fr['t_recuperacion_a_0_02Hz_desde_evento_s'])} s; caudal final {c(Fr['caudal_final_m3_s'], 2)} m³/s.

Comprobaciones: pendiente inicial teórica {c(Fc['pendiente_inicial_teorica_Hz_s'], 3)} Hz/s, simulada {c(Fc['pendiente_inicial_simulada_Hz_s'], 3)} Hz/s; desviación estacionaria de la regulación primaria con D = 0: {c(Fc['desviacion_primaria_estacionaria_D0_Hz'], 3)} Hz (teórica {c(Fc['desviacion_primaria_teorica_D0_Hz'], 3)} Hz); con D = {c(F['D_pu'])}: {c(Fc['desviacion_primaria_estacionaria_con_D_Hz'], 3)} Hz (teórica {c(Fc['desviacion_primaria_teorica_con_D_Hz'], 3)} Hz); con la mitad del paso el mínimo cambia {Fc['diferencia_por_paso_Hz']} Hz.

La caída de casi 2 Hz es propia de una unidad hidráulica sola y aislada con un escalón del 10 %: el estatismo transitorio hace que el regulador sea deliberadamente lento para respetar la inercia del agua. En un sistema interconectado la desviación sería mucho menor. El video lo indica en pantalla.

Tiempo de montaje: antes del evento × 1; primeros 4 s × 1/3; de 14 a 44 s × 3; de 44 a 100 s × 7. El reloj del ensayo y la velocidad de reproducción se muestran en el panel.

## Ensayo de tensión (red de impedancia finita)

Modelo: {E['ensayo_tension']['hipotesis']}

| Parámetro | Valor |
|---|---:|
| Base | {c(Vp['base_MVA'])} MVA |
| xd / xq / x'd | {c(Vp['xd'], 2)} / {c(Vp['xq'], 2)} / {c(Vp['xd_transitoria'], 2)} pu |
| T'd0 | {c(Vp['Td0_transitoria_s'])} s |
| Reactancia del transformador / de la red (Thévenin) | {c(Vp['x_transformador'], 2)} / {c(Vp['x_thevenin'], 2)} pu |
| AVR: ganancia, constante de tiempo, techo de excitación | {Vp['AVR_Ka']}, {c(Vp['AVR_Ta_s'], 2)} s, {c(Vp['Efd_max_pu'])} pu |
| Potencia activa | {Vp['P_MW']} MW, constante |
| Evento | carga reactiva de {Vp['carga_reactiva_final_MVAr']} MVAr (admitancia constante) en el punto de conexión, t = {Vp['t_evento_s']} s |

Resultados: tensión en el punto de conexión {c(Vr['antes']['V_conexion_kV'])} kV antes, mínimo {c(Vr['minimo_V_conexion_kV'])} kV, {c(Vr['final_con_AVR']['V_conexion_kV'])} kV con AVR; con excitación fija bajaría hasta {c(Vr['final_sin_AVR_excitacion_fija']['V_conexion_kV'])} kV. Potencia reactiva del generador {c(Vr['antes']['Q_generador_MVAr'])} → {c(Vr['final_con_AVR']['Q_generador_MVAr'])} MVAr (límite ilustrativo a factor de potencia nominal: {c(Vr['Q_a_factor_de_potencia_nominal_MVAr'])} MVAr). Corriente de campo {c(Vr['antes']['I_campo_pu'], 2)} → {c(Vr['final_con_AVR']['I_campo_pu'], 2)} pu. La excitación alcanza su techo durante el transitorio.

Alcance: no se modela la oscilación electromecánica ni los limitadores de sobreexcitación; la curva P-Q completa no se muestra. Tiempo de montaje: × 1 antes del evento y × 1/40 durante 0,4 s.

## Archivos

`datos/ensayo_frecuencia.csv`, `datos/ensayo_tension.csv` (series), `datos/ensayos_resumen.json`, `datos/derivados.json`, `datos/parametros.json`. Para reproducir: `python sim/ensayos.py`.
"""
open(os.path.join(OUT, 'Datos_e_hipotesis.md'), 'w', encoding='utf-8').write(d)
os.makedirs(os.path.join(OUT, 'datos'), exist_ok=True)
for f in ('parametros.json', 'derivados.json', 'ensayos_resumen.json', 'ensayo_frecuencia.csv', 'ensayo_tension.csv'):
    shutil.copyfile(os.path.join(ROOT, 'datos', f), os.path.join(OUT, 'datos', f))
print('escritos:', ', '.join(sorted(os.listdir(OUT))))
