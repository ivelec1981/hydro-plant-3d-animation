# Comprobación numérica del campo giratorio: tres contribuciones de fase que pulsan sobre ejes fijos
# suman una onda fundamental que gira con amplitud constante (caso ideal equilibrado).
#   F_a = F_pk·cos(θe)·cos(ωt − φ),  F_b = F_pk·cos(θe − 2π/3)·cos(ωt − φ − 2π/3),
#   F_c = F_pk·cos(θe + 2π/3)·cos(ωt − φ + 2π/3),  F_s = (3/2)·F_pk·cos(θe − ωt + φ)
#   python sim/campo_trifasico.py   ->  datos/campo_trifasico.json
import json, os
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
P = json.load(open(os.path.join(ROOT, 'datos', 'parametros.json'), encoding='utf-8'))
polos = P['maquina']['polos']; f = P['maquina']['frecuencia_Hz']
phi = 0.6; Fpk = 1.0                                   # fase temporal arbitraria y amplitud normalizada
th = np.linspace(0, 2 * np.pi, 721)[None, :]           # ángulo eléctrico
wt = np.linspace(0, 2 * np.pi, 361)[:, None]           # un ciclo eléctrico
k = 2 * np.pi / 3
Fa = Fpk * np.cos(th) * np.cos(wt - phi)
Fb = Fpk * np.cos(th - k) * np.cos(wt - phi - k)
Fc = Fpk * np.cos(th + k) * np.cos(wt - phi + k)
Fs = Fa + Fb + Fc
ref = 1.5 * Fpk * np.cos(th - wt + phi)
amp = Fs.max(axis=1); pico = th[0][Fs.argmax(axis=1)]
vel = np.unwrap(pico)                                  # posición del máximo frente a ωt
res = {
    'descripcion': 'Suma de las tres contribuciones fundamentales de fase, caso ideal equilibrado, unidades normalizadas (F_pk = 1).',
    'error_maximo_frente_a_1_5_cos': float(np.abs(Fs - ref).max()),
    'amplitud_resultante_min': float(amp.min()), 'amplitud_resultante_max': float(amp.max()),
    'amplitud_de_cada_fase_en_su_eje': Fpk,
    'giro_del_maximo_por_ciclo_electrico_rad': float(vel[-1] - vel[0]),
    'pares_de_polos': polos // 2, 'ciclos_electricos_por_vuelta': polos // 2,
    'velocidad_del_campo_rpm': 120 * f / polos,
    'alcance': 'Solo la componente fundamental; no representa armónicos espaciales, ranurado ni saturación. La representación de la animación (un par de polos) es equivalente; en la máquina de 20 polos θe = 10·θm.',
}
json.dump(res, open(os.path.join(ROOT, 'datos', 'campo_trifasico.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(res, ensure_ascii=False, indent=1))
