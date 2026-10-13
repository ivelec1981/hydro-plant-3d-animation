# Genera datos/guion_en.json: narración en inglés con la misma división en frases que el guion
# en español. Cada frase empieza en el mismo instante que su equivalente (datos/voz.json), de modo
# que los límites de escena y el montaje no cambian.
#   python audio/tools/0_guion_en.py
import json, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
G = json.load(open(os.path.join(ROOT, 'datos', 'guion.json'), encoding='utf-8'))
V = json.load(open(os.path.join(ROOT, 'datos', 'voz.json'), encoding='utf-8'))

TIT = ['The question and the whole system', 'Head, flow and conduit', 'The Pelton turbine', 'Inside the generator', 'Synchronisation and voltage step-up',
       'From the transmission system to the user', 'When demand rises', 'When reactive demand rises', 'Recap']
# (subtítulo, texto para el sintetizador); el carácter | separa los cortes de subtítulo
EN = [
 [("How does water in a reservoir|become electricity for a city?",) * 2,
  ("The journey combines hydraulic energy,|mechanical motion and electrical phenomena.",) * 2,
  ("We will follow it step by step|and then see how the plant responds|when the needs of the system change.",) * 2],
 [("Head and flow determine|the energy we can use.",) * 2,
  ("Part of it is lost along the conduit;|that is why we use the net head.",) * 2,
  ("In this example, a head of 400 metres|and 8.5 cubic metres per second|yield about 30 megawatts,|after turbine and generator losses.",
   "In this example, a head of four hundred metres|and eight point five cubic metres per second|yield about thirty megawatts,|after turbine and generator losses.")],
 [("At the nozzle, the water pressure|becomes a high-speed jet.",) * 2,
  ("The jet strikes the buckets|of the Pelton turbine tangentially|and changes direction.",) * 2,
  ("That interaction makes the runner turn.",) * 2,
  ("The shaft carries mechanical power to the generator,|while the water leaves through the tailrace.",) * 2],
 [("The rotor turns with the turbine.",) * 2,
  ("Its electromagnets produce a magnetic field|that moves past the windings|of the stator, which stays fixed.",) * 2,
  ("That change induces voltage.",) * 2,
  ("The windings are arranged|to produce three phases.",) * 2,
  ("In this illustrative machine, 20 poles|and 360 revolutions per minute|correspond to 60 hertz.",
   "In this illustrative machine, twenty poles|and three hundred sixty revolutions per minute|correspond to sixty hertz.")],
 [("Before connecting the generator,|its voltage, frequency and phase angle|must match those of the grid.",) * 2,
  ("Once the breaker closes,|it can deliver power.",) * 2,
  ("The transformer steps the voltage up|from 13.8 to 230 kilovolts.", "The transformer steps the voltage up|from thirteen point eight to two hundred thirty kilovolts."),
  ("The same power is then transmitted|with less current and lower losses|in the conductors.",) * 2],
 [("Energy travels along the transmission line|and reaches substations that step the voltage down.",) * 2,
  ("It then passes through subtransmission|and medium-voltage feeders.",) * 2,
  ("A distribution transformer adapts the supply|for low-voltage users.",) * 2,
  ("Every level needs switching,|metering and protection equipment|to operate safely and without interruption.",) * 2],
 [("To observe the response,|we isolate an equivalent system|and raise its demand|from 20 to 23 megawatts.",
   "To observe the response,|we isolate an equivalent system|and raise its demand|from twenty to twenty-three megawatts."),
  ("At first, mechanical power|does not change instantly:",) * 2,
  ("rotating energy helps cover the deficit|and the frequency falls.",) * 2,
  ("The governor admits more water|and delivers more power.",) * 2,
  ("Primary regulation arrests the drop;",) * 2,
  ("a secondary action adjusts the setpoint|to bring the frequency back to 60 hertz.", "a secondary action adjusts the setpoint|to bring the frequency back to sixty hertz.")],
 [("A rise in reactive demand|can lower the voltage at the connection point.",) * 2,
  ("Here another control steps in:|the automatic voltage regulator.",) * 2,
  ("It adjusts the rotor excitation|to change the electrical response of the generator|and support the voltage.",) * 2,
  ("Its action is limited|by the capability of the machine.",) * 2,
  ("The governor and the excitation system|perform different functions,|although they work within the same system.",) * 2],
 [("Water supplies energy, the turbine produces motion|and the generator converts it into electricity.",) * 2,
  ("Transformers make it possible|to transmit and distribute it.",) * 2,
  ("Controls and protection|keep operation within limits.",) * 2,
  ("Understanding the plant means following that whole chain,|from the water resource|to the needs of the user.",) * 2],
]
out = {'titulo': 'From water to electricity', 'subtitulo': 'Hydroelectric plant with a Pelton turbine and a synchronous generator', 'fps': G['fps'], 'duracion': G['duracion'],
       'voz': {'motor': 'piper', 'nombre': 'en_US-ryan-high', 'velocidad': '1.32', 'idioma': 'en-US',
               'licencia': 'Voz de Piper entrenada con RyanSpeech (CC BY-NC-SA 4.0): uso no comercial'},
       'nota': 'English narration. Each sentence starts at the instant of its Spanish counterpart, so scene limits and the picture timeline are unchanged.', 'escenas': []}
for e, ve, tit, frases in zip(G['escenas'], V['escenas'], TIT, EN):
    assert len(frases) == len(e['voz']), e['n']
    out['escenas'].append({'n': e['n'], 'ini': e['ini'], 'fin': e['fin'], 'titulo': tit,
                           'voz': [{'en': round(fv['ini'] - e['ini'], 3), 'sub': s, 'tts': t} for (s, t), fv in zip(frases, ve['frases'])]})
json.dump(out, open(os.path.join(ROOT, 'datos', 'guion_en.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('datos/guion_en.json')
