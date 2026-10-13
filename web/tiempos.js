// Timeline. Scene limits come from datos/guion.json; named instants are tied to the word of the
// real narration that mentions them, so re-synthesising the voice moves the pictures with it.
import { pw } from './util.js';

// English word that plays the role of each Spanish anchor word (scene.sentence.prefix)
const EN = {
  '1.2.hidraulica': 'hydraulic', '1.2.mecanico': 'mechanical', '1.2.electricos': 'electrical',
  '2.1.desnivel': 'head', '2.2.pierde': 'lost', '2.2.salto': 'net', '2.2.neto': 'head',
  '2.3.cuatrocientos': 'four', '2.3.ocho': 'eight', '2.3.permiten': 'yield', '2.3.treinta': 'thirty', '2.3.considerando': 'after',
  '3.1.chorro': 'jet', '3.2.el': 'the', '3.2.golpea': 'strikes', '3.2.cucharas': 'buckets', '3.3.esa': 'that', '3.3.produce': 'makes', '3.3.giro': 'runner', '3.3.rodete': 'turn',
  '3.4.el': 'the', '3.4.eje': 'shaft', '3.4.transmite': 'carries', '3.4.generador': 'generator', '3.4.agua': 'water',
  '4.1.rotor': 'rotor', '4.1.turbina': 'turbine', '4.2.electroimanes': 'electromagnets', '4.2.campo': 'magnetic', '4.2.magnetico': 'field', '4.2.estator': 'stator', '4.2.fijo': 'fixed',
  '4.3.ese': 'that', '4.4.los': 'the', '4.4.producir': 'produce', '4.5.en': 'in', '4.5.veinte': 'twenty', '4.5.corresponden': 'correspond',
  '5.1.tension': 'voltage', '5.1.frecuencia': 'frequency', '5.1.fase': 'phase', '5.2.cierre': 'closes', '5.3.transformador': 'transformer', '5.3.eleva': 'steps', '5.3.doscientos': 'two',
  '5.4.asi': 'the', '5.4.misma': 'same', '5.4.menor': 'less',
  '6.1.llega': 'reaches', '6.1.subestaciones': 'substations', '6.1.reducen': 'step', '6.2.despues': 'it', '6.2.subtransmision': 'subtransmission', '6.2.alimentadores': 'medium', '6.2.media': 'medium',
  '6.3.un': 'a', '6.3.transformador': 'distribution', '6.3.distribucion': 'transformer', '6.3.usuarios': 'users', '6.3.baja': 'low', '6.4.cada': 'every', '6.4.equipos': 'switching', '6.4.proteccion': 'protection',
  '7.4.gobernador': 'governor', '7.4.admision': 'admits', '7.4.agua': 'water', '7.4.potencia': 'power',
  '8.1.tension': 'voltage', '8.2.regulador': 'automatic', '8.2.tension': 'regulator', '8.3.excitacion': 'rotor', '8.3.rotor': 'excitation', '8.4.su': 'its', '8.4.limitada': 'limited',
  '8.5.el': 'the', '8.5.gobernador': 'governor', '8.5.excitacion': 'excitation', '9.1.agua': 'water', '9.1.turbina': 'turbine', '9.3.controles': 'controls',
};

export function makeTimes(voz, series, lang = 'es') {
  const S = [0, ...voz.escenas.map((e) => e.ini), voz.escenas[voz.escenas.length - 1].fin];      // S[n] = start of scene n
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // instant of the first word of sentence k (1-based) of scene n that starts with the given prefix
  const W = (n, k, pre, nth = 1) => {
    if (lang === 'en') { const q = EN[`${n}.${k}.${pre}`]; if (!q) throw new Error(`no English anchor for ${n}.${k}.${pre}`); pre = q; }
    const f = voz.escenas[n - 1].frases[k - 1]; let c = 0;
    for (const [t, w] of f.palabras) if (norm(w).startsWith(norm(pre)) && ++c === nth) return t;
    throw new Error(`palabra «${pre}» no encontrada en la escena ${n}, frase ${k}: ${f.palabras.map((w) => w[1]).join(' ')}`);
  };
  const F = (n, k) => voz.escenas[n - 1].frases[k - 1];
  const T = { S, W, F, fin: S[10] };

  // ---- 7: frequency test. One physical time; the playback speed is shown on screen.
  const fr = series.frecuencia, ev7 = F(7, 2).ini - 0.7;                    // montage instant of the load step
  T.f = { t0: S[7] + 3.2, ev: ev7, a: ev7 + 12, b: ev7 + 22, c: ev7 + 30 };
  T.tph7 = (t) => pw([[ev7 - fr.t_evento, 0], [ev7, fr.t_evento], [T.f.a, fr.t_evento + 4], [T.f.b, fr.t_evento + 34], [T.f.c, 100]], t);
  T.vel7 = (t) => (t < ev7 ? '× 1' : t < T.f.a ? '× 1/3' : t < T.f.b ? '× 3' : t < T.f.c ? '× 7' : 'detenido');
  // ---- 8: voltage test. Slow motion around the step.
  const te = series.tension, ev8 = W(8, 1, 'tension') + 0.5;
  T.v = { t0: S[8] + 3.4, ev: ev8, a: ev8 + 16 };
  T.tph8 = (t) => pw([[ev8 - te.t_evento, 0], [ev8, te.t_evento], [T.v.a, te.t_evento + 0.4]], t);
  T.vel8 = (t) => (t < ev8 ? '× 1' : t < T.v.a ? '× 1/40' : 'detenido');
  return T;
}
