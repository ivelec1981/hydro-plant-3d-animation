# Cálculos y ensayos del caso ilustrativo. Lee datos/parametros.json (fuente única) y escribe:
#   datos/derivados.json            magnitudes calculadas que usan la animación, los rótulos y el guion
#   datos/ensayo_frecuencia.csv     series del ensayo aislado de frecuencia (tiempo físico)
#   datos/ensayo_tension.csv        series del ensayo de tensión con red de Thévenin
#   datos/ensayos_resumen.json      parámetros, resultados y comprobaciones numéricas
#   datos/series_web.json           las mismas series, diezmadas, para la animación
#   python sim/ensayos.py
import json, math, os
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
D = os.path.join(ROOT, 'datos')
P = json.load(open(os.path.join(D, 'parametros.json'), encoding='utf-8'))
h, m, red = P['hidraulica'], P['maquina'], P['red']
rho, g, Hn, Qd, eta = h['rho_kg_m3'], h['g_m_s2'], h['salto_neto_m'], h['caudal_diseno_m3_s'], h['eficiencia_turbina_generador']


def potencia_MW(Q, H=Hn): return rho * g * Q * H * eta / 1e6
def caudal(P_MW): return P_MW * 1e6 / (rho * g * Hn * eta)

# ------------------------------------------------------------------ magnitudes derivadas
f0, polos = m['frecuencia_Hz'], m['polos']
n_s = 120 * f0 / polos                                   # rpm, p = número de polos
omega = n_s * 2 * math.pi / 60
v_chorro = h['coef_velocidad_boquilla'] * math.sqrt(2 * g * Hn)
u_cuchara = h['relacion_velocidad_cuchara_chorro'] * v_chorro
D_rodete = 2 * u_cuchara / omega                         # diámetro primitivo
q_iny = Qd / h['inyectores']
d_chorro = math.sqrt(4 * q_iny / (math.pi * v_chorro))
A_tub = math.pi * h['tuberia_diametro_m'] ** 2 / 4
P_dis = potencia_MW(Qd)
I = lambda P_MW, kV: P_MW * 1e6 / (math.sqrt(3) * kV * 1e3)
der = {
    'potencia_diseno_MW': round(P_dis, 3),
    'potencia_hidraulica_disponible_MW': round(rho * g * Qd * Hn / 1e6, 3),
    'caudal_20MW_m3_s': round(caudal(m['despacho_inicial_MW']), 3),
    'caudal_23MW_m3_s': round(caudal(m['demanda_final_MW']), 3),
    'caudal_30MW_m3_s': round(caudal(m['limite_activo_MW']), 4),
    'velocidad_sincronica_rpm': n_s,
    'comprobacion_frecuencia_Hz': polos * n_s / 120,
    'presion_estatica_en_boquilla_bar': round(rho * g * Hn / 1e5, 1),
    'velocidad_chorro_m_s': round(v_chorro, 1),
    'velocidad_chorro_km_h': round(v_chorro * 3.6),
    'velocidad_cuchara_m_s': round(u_cuchara, 1),
    'diametro_primitivo_rodete_m': round(D_rodete, 2),
    'diametro_chorro_m': round(d_chorro, 3),
    'relacion_D_d': round(D_rodete / d_chorro, 1),
    'cucharas_estimadas': round(15 + D_rodete / (2 * d_chorro)),
    'velocidad_agua_tuberia_m_s': round(Qd / A_tub, 2),
    'corriente_30MW_13_8kV_A': round(I(30, red['media_tension_kV'])),
    'corriente_30MW_230kV_A': round(I(30, red['transmision_kV']), 1),
    'corriente_30MW_69kV_A': round(I(30, red['subtransmision_kV'])),
    'relacion_transformacion_elevador': round(red['transmision_kV'] / m['tension_bornes_kV'], 2),
    'tension_fase_neutro_MT_kV': round(red['media_tension_kV'] / math.sqrt(3), 2),
    'supuestos': 'Eficiencia constante de 0,90 (turbina y generador). Una curva real de eficiencia varía con la carga. Corrientes con factor de potencia 1 y sin pérdidas.',
}

# ------------------------------------------------------------------ ensayo de frecuencia (sistema aislado)
F = P['ensayo_frecuencia']
Sb = F['base_MW']
Qb = caudal(Sb)                                          # caudal que da 1 pu de potencia con el salto neto
Tw = h['tuberia_longitud_m'] * Qb / (g * A_tub * Hn)      # tiempo de arranque del agua


def ensayo_f(dt, D_pu=None, secundaria=True, t_fin=None, paso_MW=None):
    D_pu = F['D_pu'] if D_pu is None else D_pu
    t_fin = F['t_final_s'] if t_fin is None else t_fin
    P0 = m['despacho_inicial_MW'] / Sb
    P1 = (m['demanda_final_MW'] if paso_MW is None else m['despacho_inicial_MW'] + paso_MW) / Sb
    Rp, Rt, Tr, Tg, vmax = F['estatismo_permanente'], F['estatismo_transitorio'], F['T_reposicion_s'], F['T_servo_s'], F['velocidad_max_aguja_pu_s']
    gmax = Qd / Qb
    n = int(round(t_fin / dt)) + 1
    t = np.arange(n) * dt
    # estado: desviación de velocidad, caudal, aguja, memoria del estatismo transitorio, consigna
    def deriv(y, tt):
        dw, q, ga, xr, gref = y
        hh = (q / ga) ** 2                                # salto en la boquilla (pu)
        Pm = q * hh                                       # potencia mecánica con eficiencia constante
        Pe = P0 if tt < F['t_evento_s'] else P1
        ddw = ((Pm - Pe) / (1 + dw) - D_pu * dw) / (2 * F['H_s'])   # par = potencia / velocidad
        dq = (1 - hh) / Tw
        dga = (-dw - Rp * (ga - gref) - Rt * (ga - xr)) / Tg
        dga = max(-vmax, min(vmax, dga))
        if (ga >= gmax and dga > 0) or (ga <= max(F['apertura_min_pu'], 0.02) and dga < 0): dga = 0.0
        dxr = (ga - xr) / Tr
        dgref = -F['secundaria_Ki_pu_s'] * dw if (secundaria and tt >= F['t_evento_s'] + F['secundaria_retardo_s']) else 0.0
        return np.array([ddw, dq, dga, dxr, dgref])
    y = np.array([0.0, P0, P0, P0, P0])
    out = np.zeros((n, 7))
    for i in range(n):
        dw, q, ga, xr, gref = y
        hh = (q / ga) ** 2
        out[i] = [t[i], (P0 if t[i] < F['t_evento_s'] else P1) * Sb, q * hh * Sb, f0 * (1 + dw), ga, q * Qb, gref * Sb]
        k1 = deriv(y, t[i]); k2 = deriv(y + 0.5 * dt * k1, t[i] + 0.5 * dt); k3 = deriv(y + 0.5 * dt * k2, t[i] + 0.5 * dt); k4 = deriv(y + dt * k3, t[i] + dt)
        y = y + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
    return out


def resumen_f(o):
    i = int(np.argmin(o[:, 3])); te = F['t_evento_s']
    post = o[o[:, 0] >= te]
    rec = post[np.abs(post[:, 3] - f0) > 0.02]
    return {'nadir_Hz': round(float(o[i, 3]), 4), 't_nadir_desde_evento_s': round(float(o[i, 0] - te), 2), 'f_final_Hz': round(float(o[-1, 3]), 4),
            'Pm_min_tras_evento_MW': round(float(post[:200 * 5, 2].min()), 3), 'Pm_final_MW': round(float(o[-1, 2]), 3), 'caudal_final_m3_s': round(float(o[-1, 5]), 3),
            'apertura_final_pu': round(float(o[-1, 4]), 4), 't_recuperacion_a_0_02Hz_desde_evento_s': round(float(rec[-1, 0] - te), 1) if len(rec) else 0.0}


freq = ensayo_f(F['dt_s'])
rf = resumen_f(freq)
# comprobaciones: paso de integración y desviación estacionaria de la regulación primaria
rf_mitad = resumen_f(ensayo_f(F['dt_s'] / 2))
prim = ensayo_f(F['dt_s'], secundaria=False, t_fin=400)
prim_ideal = ensayo_f(F['dt_s'], D_pu=0.0, secundaria=False, t_fin=400)
rocof = (m['despacho_inicial_MW'] - m['demanda_final_MW']) / Sb / (2 * F['H_s']) * f0
comp_f = {
    'tiempo_arranque_agua_Tw_s': round(Tw, 3),
    'energia_cinetica_MJ': round(F['H_s'] * Sb, 1),
    'pendiente_inicial_teorica_Hz_s': round(rocof, 3),
    'pendiente_inicial_simulada_Hz_s': round(float((freq[int((F['t_evento_s'] + 0.1) / F['dt_s']), 3] - f0) / 0.1), 3),
    'nadir_con_dt': rf['nadir_Hz'], 'nadir_con_dt_mitad': rf_mitad['nadir_Hz'], 'diferencia_por_paso_Hz': round(abs(rf['nadir_Hz'] - rf_mitad['nadir_Hz']), 6),
    'desviacion_primaria_estacionaria_D0_Hz': round(float(prim_ideal[-1, 3] - f0), 4),
    'desviacion_primaria_teorica_D0_Hz': round(-F['estatismo_permanente'] * f0 * (m['demanda_final_MW'] - m['despacho_inicial_MW']) / Sb, 4),
    'desviacion_primaria_estacionaria_con_D_Hz': round(float(prim[-1, 3] - f0), 4),
    'desviacion_primaria_teorica_con_D_Hz': round(-f0 * ((m['demanda_final_MW'] - m['despacho_inicial_MW']) / Sb) / (1 / F['estatismo_permanente'] + F['D_pu']), 4),
}

# ------------------------------------------------------------------ ensayo de tensión (red de Thévenin)
V = P['ensayo_tension']
Sv = V['base_MVA']


def red_eq(B):
    """Equivalente visto desde bornes con carga inductiva de susceptancia B (pu) en el punto de conexión."""
    return V['E_thevenin_pu'] / (1 + V['x_thevenin'] * B), V['x_transformador'] + V['x_thevenin'] / (1 + V['x_thevenin'] * B)


def punto(Eq1, B, Pm):
    """Resuelve el ángulo de carga con P_e = P_m (se desprecia la oscilación electromecánica)."""
    Ee, Xe = red_eq(B)
    xd1, xq = V['xd_transitoria'], V['xq']
    de = 0.5
    for _ in range(60):
        id_ = (Eq1 - Ee * math.cos(de)) / (xd1 + Xe); iq = Ee * math.sin(de) / (xq + Xe)
        Pe = Eq1 * iq + (xq - xd1) * id_ * iq
        did = Ee * math.sin(de) / (xd1 + Xe); diq = Ee * math.cos(de) / (xq + Xe)
        dP = Eq1 * diq + (xq - xd1) * (did * iq + id_ * diq)
        paso = (Pe - Pm) / dP; de -= paso
        if abs(paso) < 1e-12: break
    id_ = (Eq1 - Ee * math.cos(de)) / (xd1 + Xe); iq = Ee * math.sin(de) / (xq + Xe)
    vd, vq = xq * iq, Eq1 - xd1 * id_
    Vt = math.hypot(vd, vq); Qg = vq * id_ - vd * iq
    Ifd = Eq1 + (V['xd'] - xd1) * id_                     # corriente de campo (pu, base de vacío)
    # tensión en el punto de conexión: bornes menos la caída en el transformador
    Vd_p, Vq_p = vd + V['x_transformador'] * iq, vq - V['x_transformador'] * id_
    return dict(delta=de, id=id_, iq=iq, Vt=Vt, Qg=Qg, Ifd=Ifd, Vp=math.hypot(Vd_p, Vq_p), I=math.hypot(id_, iq))


def ensayo_v(dt, con_avr=True):
    Pm = V['P_MW'] / Sv
    B0, B1 = V['carga_reactiva_inicial_MVAr'] / Sv, V['carga_reactiva_final_MVAr'] / Sv
    # condición inicial: Efd tal que la tensión en bornes cumple la consigna con error estático del AVR
    lo, hi = 0.5, 3.0
    for _ in range(80):                                   # bisección sobre E'q para Vt = consigna - Efd/Ka
        Eq1 = (lo + hi) / 2; s = punto(Eq1, B0, Pm)
        if s['Vt'] + s['Ifd'] / V['AVR_Ka'] < V['consigna_bornes_pu']: lo = Eq1
        else: hi = Eq1
    s = punto(Eq1, B0, Pm); Efd = s['Ifd']
    Vref = s['Vt'] + Efd / V['AVR_Ka']
    n = int(round(V['t_final_s'] / dt)) + 1
    out = np.zeros((n, 8))
    for i in range(n):
        tt = i * dt; B = B0 if tt < V['t_evento_s'] else B1
        s = punto(Eq1, B, Pm)
        out[i] = [tt, s['Vp'] * red['transmision_kV'], s['Vt'] * m['tension_bornes_kV'], s['Qg'] * Sv, s['Ifd'], Efd, Pm * Sv, s['I']]
        dEq = (Efd - s['Ifd']) / V['Td0_transitoria_s']
        dEfd = (V['AVR_Ka'] * (Vref - s['Vt']) - Efd) / V['AVR_Ta_s'] if con_avr else 0.0
        Eq1 += dt * dEq; Efd = min(V['Efd_max_pu'], max(V['Efd_min_pu'], Efd + dt * dEfd))
    return out


ten = ensayo_v(V['dt_s']); ten_sin = ensayo_v(V['dt_s'], con_avr=False); ten_mitad = ensayo_v(V['dt_s'] / 2)
ie = int(V['t_evento_s'] / V['dt_s'])
Q_nom = V['base_MVA'] * math.sqrt(1 - m['factor_potencia_nominal'] ** 2)
rv = {
    'antes': {'V_conexion_kV': round(float(ten[ie - 1, 1]), 2), 'V_bornes_kV': round(float(ten[ie - 1, 2]), 3), 'Q_generador_MVAr': round(float(ten[ie - 1, 3]), 2), 'I_campo_pu': round(float(ten[ie - 1, 4]), 3)},
    'minimo_V_conexion_kV': round(float(ten[:, 1].min()), 2),
    'final_con_AVR': {'V_conexion_kV': round(float(ten[-1, 1]), 2), 'V_bornes_kV': round(float(ten[-1, 2]), 3), 'Q_generador_MVAr': round(float(ten[-1, 3]), 2), 'I_campo_pu': round(float(ten[-1, 4]), 3)},
    'final_sin_AVR_excitacion_fija': {'V_conexion_kV': round(float(ten_sin[-1, 1]), 2), 'V_bornes_kV': round(float(ten_sin[-1, 2]), 3), 'Q_generador_MVAr': round(float(ten_sin[-1, 3]), 2)},
    'Q_a_factor_de_potencia_nominal_MVAr': round(Q_nom, 1),
    'I_estator_final_pu': round(float(ten[-1, 7]), 3),
    'Efd_maximo_alcanzado_pu': round(float(ten[:, 5].max()), 3), 'Efd_techo_pu': V['Efd_max_pu'],
    'diferencia_por_paso_kV': round(float(abs(ten[::1, 1].min() - ten_mitad[:, 1].min())), 5),
}

# ------------------------------------------------------------------ salidas
np.savetxt(os.path.join(D, 'ensayo_frecuencia.csv'), freq[::25], delimiter=',', fmt='%.5f', comments='',
           header='t_s,demanda_MW,potencia_mecanica_MW,frecuencia_Hz,apertura_aguja_pu,caudal_m3_s,consigna_MW')
np.savetxt(os.path.join(D, 'ensayo_tension.csv'), np.column_stack([ten[::10, :7], ten_sin[::10, 1], ten_sin[::10, 3]]), delimiter=',', fmt='%.5f', comments='',
           header='t_s,V_conexion_kV,V_bornes_kV,Q_generador_MVAr,I_campo_pu,Efd_pu,P_MW,V_conexion_sin_AVR_kV,Q_sin_AVR_MVAr')
json.dump(der, open(os.path.join(D, 'derivados.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump({'ensayo_frecuencia': {'parametros': F, 'resultados': rf, 'comprobaciones': comp_f,
                                 'hipotesis': 'Una sola unidad en un sistema aislado; demanda de potencia constante con amortiguamiento D; turbina no lineal con columna de agua inelástica; regulador con estatismo permanente y transitorio, velocidad de aguja limitada; control secundario integral lento. Eficiencia constante.'},
           'ensayo_tension': {'parametros': V, 'resultados': rv,
                              'hipotesis': 'Generador de polos salientes, modelo de un eje (E\'q); AVR estático de primer orden; red sin resistencias; carga reactiva de admitancia constante; potencia activa constante y ángulo de carga cuasiestático (sin oscilación electromecánica).'}},
          open(os.path.join(D, 'ensayos_resumen.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
r3 = lambda a: [round(float(x), 4) for x in a]
fw, tw_ = freq[::50], ten[::2]
json.dump({'frecuencia': {'dt': F['dt_s'] * 50, 't_evento': F['t_evento_s'], 't_secundaria': F['t_evento_s'] + F['secundaria_retardo_s'], 'Pe': r3(fw[:, 1]), 'Pm': r3(fw[:, 2]), 'f': r3(fw[:, 3]), 'aguja': r3(fw[:, 4]), 'Q': r3(fw[:, 5]), 'resumen': rf, 'comp': comp_f},
           'tension': {'dt': V['dt_s'] * 2, 't_evento': V['t_evento_s'], 'Vp': r3(tw_[:, 1]), 'Vt': r3(tw_[:, 2]), 'Qg': r3(tw_[:, 3]), 'If': r3(tw_[:, 4]), 'Vp_sin': r3(ten_sin[::2, 1]), 'Qg_sin': r3(ten_sin[::2, 3]), 'resumen': rv},
           'derivados': der, 'parametros': P},
          open(os.path.join(D, 'series_web.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(json.dumps(der, ensure_ascii=False, indent=1))
print('FRECUENCIA', json.dumps(rf, ensure_ascii=False)); print(json.dumps(comp_f, ensure_ascii=False, indent=1))
print('TENSION', json.dumps(rv, ensure_ascii=False, indent=1))
