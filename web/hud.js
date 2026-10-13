// Graphic layer: chapter chip, tags, labels with leader lines, cards, charts and credits.
// Every text and figure is an exact vector/HTML layer drawn over the 3D image; the numbers come
// from datos/series_web.json (same source as the model). update(t) sets everything from the time
// alone, so any frame can be rendered on its own. The bottom 134 px stay free for subtitles.
import { COL, clamp, lerp, ss, env, serie, fmt, DEG } from './util.js';
import { RUN, NOZ, nozzle, PIT, GEN, X, LAKE, ZL } from './layout.js';
import { penY, PEN } from './terreno.js';
import { OMEGA } from './escena.js';
import { makeTx } from './textos.js';

const f2 = (x) => x.toFixed(2);
const P3 = (r, a, y) => [r * Math.cos(a), y, r * Math.sin(a)];

export function createHud(root, lines, guion, voz, T, world, D, showSubs, lang = 'es') {
  const tx = makeTx(lang);
  const S = T.S, W = T.W, der = D.derivados, par = D.parametros, fr = D.frecuencia, te = D.tension, hero = nozzle(NOZ.hero), A = world.anchors;
  const el = (tag, cls, html, parent = root) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = tx(html); parent.appendChild(e); return e; };
  const sub = document.getElementById('sub'), black = document.getElementById('black');
  const chip = el('div', '', ''); chip.id = 'chip';
  const title = el('div', '', `<h1>Del agua<br>a la <em>electricidad</em></h1><p>Central hidroeléctrica con turbina Pelton y generador síncrono</p>`); title.id = 'title';
  const tagR = el('div', '', ''); tagR.id = 'tagR';

  // ---------------------------------------------------------------- tags (one at a time, top right)
  const TAGS = [
    ['Esquema espacial simplificado', S[1] + 9.8, S[2] + 2.4], ['Caso ilustrativo', S[2] + 3.2, S[3] - 0.4],
    ['Movimiento ralentizado para explicación · velocidad real: 360 rpm', S[3] + 2.6, S[5] + 2.4],
    ['Eleva tensión; no crea energía', T.trafoX + 1.4, S[6] - 0.4], ['Esquema espacial simplificado', S[6] + 3.6, S[7] - 0.7],
    ['Ensayo ilustrativo · sistema equivalente aislado', S[7] + 3.6, S[8] - 0.6], ['Ensayo ilustrativo · red de impedancia finita', S[8] + 3.8, S[9] - 0.6],
    ['Esquema espacial simplificado', S[9] + 0.8, T.fin0 - 0.2], ['Modelo educativo · parámetros ilustrativos', T.fin0 + 2.4, T.fin - 0.9],
  ];

  // ---------------------------------------------------------------- labels with leader lines
  const L = [];
  const lab = (txt, a, t0, t1, dx, dy, o = {}) => L.push({ txt, a, t0, t1, dx, dy, ...o });
  const can = A.can, gapA = 150 * DEG;
  // 1
  lab('Energía hidráulica', [-58, penY(-58) + 1, PEN.z], W(1, 2, 'hidraulica') - 0.3, S[2] - 0.4, 60, -150, { col: COL.agua });
  lab('Movimiento mecánico', [0, 9.6, 0], W(1, 2, 'mecanico') - 0.3, S[2] - 0.4, -40, 190, { col: COL.mec });
  lab('Electricidad', A.tower, W(1, 2, 'electricos') - 0.3, S[2] - 0.4, 60, -130, { col: COL.elec });
  // 2
  lab(`Caudal de diseño: ${fmt(par.hidraulica.caudal_diseno_m3_s)} m³/s`, [-44, penY(-44) + 0.7, PEN.z], W(2, 3, 'ocho') - 0.2, S[3] - 0.5, -560, 120, { col: COL.agua });
  lab(`Presión antes de la boquilla ≈ ${Math.round(der.presion_estatica_en_boquilla_bar)} bar<small>El agua conserva su presión en la tubería</small>`, [-13.8, 1.6, PEN.z], W(2, 3, 'considerando') + 0.6, S[3] + 0.5, -420, 150, { col: COL.agua });
  // 3
  lab('Boquilla y aguja', V(hero.at(-0.62), [0, 0.02, 0]), S[3] + 2.9, W(3, 2, 'el') - 0.4, 150, 190, { col: COL.agua });
  lab(`Chorro ≈ ${Math.round(der.velocidad_chorro_m_s)} m/s<small>≈ ${der.velocidad_chorro_km_h} km/h</small>`, hero.at(-0.22), W(3, 1, 'chorro') - 0.1, W(3, 2, 'cucharas') - 0.3, -330, 210, { col: COL.agua });
  lab('Cucharas dobles<small>con divisor central</small>', V(hero.at(0.36), [0, 0.1, 0]), W(3, 2, 'cucharas') - 0.1, W(3, 3, 'esa') - 0.3, -330, -230);
  lab('Par sobre el rodete', [0.62, -1.9, 0.1], W(3, 3, 'giro') - 0.2, W(3, 4, 'el') - 0.5, 150, -70, { col: COL.mec });
  lab('Eje<small>Potencia mecánica hacia el generador</small>', [GEN.shaftR, -1.3, 0.1], W(3, 4, 'eje') - 0.2, S[4] + 0.3, 150, -30, { col: COL.mec });
  lab('Canal de restitución<small>Descarga a presión atmosférica</small>', [0, PIT.water, 6.2], W(3, 4, 'agua') - 0.3, S[4] + 0.3, -470, -40, { col: COL.agua });
  // 4
  const front = 70 * DEG;
  lab('Rotor<small>Gira con la turbina</small>', P3(GEN.shoeR, front + 0.3, 1.35), W(4, 1, 'rotor') - 0.2, W(4, 2, 'campo') - 0.4, 190, 150, { col: COL.mec });
  lab('Polos con excitación<small>de corriente continua</small>', P3(GEN.shoeR - 0.2, front - 0.25, 2.62), W(4, 2, 'electroimanes'), W(4, 2, 'estator') - 0.3, -380, -230, { col: COL.campo });
  lab('Campo magnético<small>Representación conceptual</small>', P3(2.0, front - 0.62, 1.8), W(4, 2, 'campo'), W(4, 2, 'estator') - 0.3, 200, 60, { col: COL.campo });
  lab('Estator<small>Devanados fijos</small>', P3(2.05, GEN.cut[1] + 0.04, 2.0), W(4, 2, 'estator') - 0.2, W(4, 4, 'los') - 0.4, -330, -170, { col: COL.elec });
  lab('Entrehierro', P3((GEN.shoeR + GEN.boreR) / 2, GEN.cut[1] - 0.02, 2.56), W(4, 3, 'ese') + 0.2, W(4, 4, 'los') - 0.4, 190, -220);
  lab('Interruptor abierto<small>Hay tensión; aún no hay corriente hacia la red</small>', null, W(4, 5, 'en') + 0.2, S[5] + 1.6, 0, 0, { at: [70, 800], col: COL.elec });
  // 5
  lab('Interruptor de generador<small>Abierto</small>', [X.gcb, 2.55, 0.4], S[5] + 3.0, T.close, 40, -200, { col: COL.dim });
  lab('Interruptor de generador<small>Cerrado: entrega potencia</small>', [X.gcb, 2.55, 0.4], T.close, T.trafoX - 0.2, 40, -200, { col: COL.elec, fast: 1 });
  lab('Par hidráulico y par electromagnético<small>El segundo se opone al giro</small>', [0.9, GEN.top + 0.45, 0.9], T.close + 1.7, T.trafoX - 0.4, -120, -150, { col: COL.mec });
  lab(`${fmt(par.maquina.tension_bornes_kV)} kV`, A.tfLV, T.trafoX + 1.9, S[6] - 0.3, -250, -24, { big: 1, col: COL.elec });
  lab(`${par.red.transmision_kV} kV`, A.tfHV, W(5, 3, 'doscientos') - 0.2, S[6] - 0.3, 190, -60, { big: 1, col: COL.elec });
  // 6
  lab(`Subestación reductora<small>${par.red.transmision_kV} kV → ${par.red.subtransmision_kV} kV</small>`, A.t1, W(6, 1, 'subestaciones') - 0.1, W(6, 2, 'subtransmision') + 0.3, 80, -250, { col: COL.elec });
  lab(`Subestación de distribución<small>${par.red.subtransmision_kV} kV → ${fmt(par.red.media_tension_kV)} kV</small>`, A.t2, W(6, 2, 'alimentadores') - 0.2, W(6, 3, 'distribucion') - 0.2, 60, -280, { col: COL.elec });
  lab(`Transformador de distribución<small>${fmt(der.tension_fase_neutro_MT_kV, 2)} kV fase-neutro → 120/240 V</small>`, [can[0], can[1] + 0.6, can[2]], W(6, 3, 'transformador'), W(6, 4, 'cada') - 0.3, -560, -250, { col: COL.elec });
  lab('Acometida<small>Dos fases y neutro</small>', V3mix([X.polesMV[X.poleTr], 7.05, ZL - 0.2], A.house, 0.55), W(6, 3, 'usuarios') - 0.2, W(6, 4, 'cada') - 0.3, 170, 170, { col: COL.elec });
  lab('Maniobra, medición y protección<small>en cada nivel de tensión</small>', [X.sub1Brk, 5.6, 0], W(6, 4, 'equipos'), S[7] - 0.5, 30, -300, { col: COL.elec });
  // 7
  lab('Señal del gobernador<small>Servomotor y aguja del inyector</small>', V(V(hero.at(-1.2), [hero.r[0] * 0.42, 0.05, hero.r[2] * 0.42]), [0, 0, 0]), W(7, 4, 'gobernador') - 0.2, T.f.c + 1.0, -120, -260, { col: COL.mec, xmax: 980 });
  // 8
  lab('Regulador automático de tensión<small>AVR</small>', [-6.5, 2.15, -4.7], W(8, 2, 'regulador') - 0.2, W(8, 4, 'su') - 0.3, -70, -260, { col: COL.campo, xmax: 980 });
  lab(`Excitación del rotor<small>Corriente de campo: ${fmt(te.resumen.antes.I_campo_pu, 2)} → ${fmt(te.resumen.final_con_AVR.I_campo_pu, 2)} pu</small>`, [0.2, 3.9, 0.5], W(8, 3, 'excitacion') - 0.2, W(8, 5, 'el') - 0.3, 170, -150, { col: COL.campo, xmax: 980 });
  function V(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function V3mix(a, b, u) { return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
  for (const l of L) { l.el = el('div', 'lbl' + (l.big ? ' big' : ''), l.txt); if (l.col) l.el.style.borderLeftColor = l.col; l.el.style.opacity = 0; }

  // ---------------------------------------------------------------- cards
  const card = (html, t0, t1, style, o = {}) => { const e = el('div', 'card', html); e.style.cssText += style; e.style.opacity = 0; const c = { el: e, t0, t1, ...o, nodes: [...e.querySelectorAll('[data-in]')].map((n) => ({ n, t: Number(n.dataset.in) })), ck: [...e.querySelectorAll('[data-ck]')].map((n) => ({ n, t: Number(n.dataset.ck) })) }; C.push(c); return c; };
  const C = [];
  const h = par.hidraulica, m = par.maquina;
  // 2: head bracket texts (positioned from the projection) and power formula
  const hb = ['Salto bruto ' + h.salto_bruto_m + ' m', 'Pérdidas en la conducción: ' + h.perdidas_conduccion_m + ' m', 'Salto neto ' + h.salto_neto_m + ' m', 'Nivel de los inyectores'].map((t, i) => { const e = el('div', 'lbl' + (i === 2 ? ' big' : ''), t); e.style.opacity = 0; e.style.borderLeftColor = [COL.dim, COL.rojo, COL.agua, COL.dim][i]; return e; });
  const tH = { g0: W(2, 1, 'desnivel') + 0.3, loss: W(2, 2, 'pierde') - 0.2, net: W(2, 2, 'salto') - 0.3, end: W(2, 2, 'neto') + 1.5 };
  card(`<h3>Potencia eléctrica en bornes</h3><div class="eq">P = ρ · g · Q · H<sub>n</sub> · η</div>
    <p data-in="${W(2, 3, 'treinta') - 0.3}">${h.rho_kg_m3} × ${fmt(h.g_m_s2, 2)} × ${fmt(h.caudal_diseno_m3_s)} × ${h.salto_neto_m} × ${fmt(h.eficiencia_turbina_generador, 2)} ≈ <b class="hi">${fmt(der.potencia_diseno_MW)} MW</b></p>
    <p class="dim" data-in="${W(2, 3, 'considerando')}">η = ${fmt(h.eficiencia_turbina_generador, 2)}: pérdidas de turbina y generador</p>`, W(2, 3, 'permiten') - 0.3, S[3] - 0.4, 'left:1030px;top:96px;width:846px;');
  // 4: three-phase voltages and frequency relation
  const wave = card(`<h3>Tensión inducida en el estator</h3><h4>Tres fases desfasadas 120°</h4><svg id="wave" width="800" height="250" viewBox="0 0 800 250"></svg>
    <p class="dim sm">Ondas ralentizadas · frecuencia real: ${m.frecuencia_Hz} Hz</p>
    <div class="eq2" data-in="${W(4, 5, 'veinte') - 0.3}">f = polos × rpm / 120</div>
    <p data-in="${W(4, 5, 'corresponden') - 0.2}">${m.polos} × ${der.velocidad_sincronica_rpm} / 120 = <b class="hi">${der.comprobacion_frecuencia_Hz} Hz</b></p>`, W(4, 4, 'producir') + 0.2, S[5] + 0.8, 'left:1030px;top:96px;width:846px;');
  // 5: synchronisation and currents
  const tck = [W(5, 1, 'tension') + 0.7, W(5, 1, 'frecuencia') + 0.8, W(5, 1, 'fase') + 0.7];
  const sync = card(`<h3>Antes de conectar</h3><div class="row"><svg id="phas" width="250" height="250" viewBox="-125 -125 250 250"></svg><div>
    <div class="chk" data-ck="${tck[0]}"><i></i>Tensión</div><div class="chk" data-ck="${tck[1]}"><i></i>Frecuencia</div><div class="chk" data-ck="${tck[2]}"><i></i>Ángulo y secuencia<br>de fases</div></div></div>
    <p class="dim sm">Continua: generador · trazos: red</p>
    <div data-in="${T.close}"><p>Potencia entregada: <b class="hi" id="mw">0,0 MW</b></p><div class="bar"><i id="mwbar" style="background:${COL.elec}"></i></div></div>`, S[5] + 1.5, T.trafoX - 0.3, 'left:56px;top:110px;width:640px;');
  card(`<h3>Misma potencia, menor corriente</h3>
    <p data-in="${W(5, 4, 'misma') - 0.2}">30 MW a ${fmt(par.red.media_tension_kV)} kV → <b>≈ ${der.corriente_30MW_13_8kV_A.toLocaleString('es').replace('.', ' ')} A</b></p>
    <p data-in="${W(5, 4, 'menor') - 0.2}">30 MW a ${par.red.transmision_kV} kV → <b class="hi">≈ ${Math.round(der.corriente_30MW_230kV_A)} A</b></p>
    <p class="dim sm">Factor de potencia 1 y sin pérdidas, para comparar</p>`, W(5, 4, 'asi') - 0.3, S[6] - 0.3, 'left:56px;top:56px;width:760px;');
  // 6: voltage levels
  const lv = [['Transmisión', par.red.transmision_kV + ' kV'], ['Subtransmisión', par.red.subtransmision_kV + ' kV'], ['Media tensión', fmt(par.red.media_tension_kV) + ' kV'], ['Baja tensión', '120/240 V']];
  const strip = el('div', '', lv.map((x, i) => `<span class="lv" data-i="${i}"><b>${x[0]}</b>${x[1]}</span>`).join('<span class="arr">›</span>')); strip.id = 'strip'; strip.style.opacity = 0;
  const lvOn = [S[6] + 3.4, W(6, 2, 'subtransmision') - 0.2, W(6, 2, 'media') - 0.2, W(6, 3, 'baja') - 0.3, W(6, 4, 'cada') + 0.4];
  const lvEls = [...strip.querySelectorAll('.lv')];
  // 7 and 8: transition cards and test panels
  const trans = (a, b, t0, t1) => { const e = el('div', 'trans', `<small>Ensayo ilustrativo</small>${a}<em>${b}</em>`); e.style.opacity = 0; return { el: e, t0, t1 }; };
  const TR = [trans('Respuesta de frecuencia', 'Sistema equivalente aislado', S[7] + 0.15, S[7] + 3.3), trans('Respuesta de tensión', 'Conectado a una red de impedancia finita', S[8] + 0.15, S[8] + 3.5)];
  const p7 = card(`<div class="hd"><b>Ensayo de frecuencia</b></div><div class="hd2">Tiempo del ensayo: <b id="t7">0,0 s</b> · reproducción: <b id="v7">× 1</b></div>
    <div class="ct">Potencia (MW) <i style="background:${COL.elec}"></i>demanda <i style="background:${COL.mec}"></i>potencia mecánica</div><svg id="c7a" width="810" height="215" viewBox="0 0 810 215"></svg>
    <div class="ct">Frecuencia (Hz) <span id="k7"><i style="background:${COL.rojo}"></i>inercia</span><span><i style="background:${COL.mec}"></i>primaria</span><span><i style="background:${COL.elec}"></i>secundaria</span></div><svg id="c7b" width="810" height="215" viewBox="0 0 810 215"></svg>
    <div class="row tiles"><div class="tile">Demanda<b id="r7a"></b></div><div class="tile">Potencia mecánica<b id="r7b"></b></div><div class="tile">Frecuencia<b id="r7c"></b></div></div>`, S[7] + 3.4, S[8] - 0.5, 'left:1010px;top:96px;width:866px;', { weight: 2 });
  const i7 = card(`<div class="row tiles"><div class="tile">Apertura de aguja<b id="g7"></b></div><div class="tile">Caudal<b id="q7"></b></div><div class="tile">Velocidad<b id="n7"></b></div></div>
    <p class="dim sm">Movimiento de la aguja ampliado × 3. Una unidad sola y aislada: la desviación es mayor que en un sistema interconectado.</p>`, S[7] + 3.8, S[8] - 0.5, 'left:44px;top:700px;width:930px;');
  const p8 = card(`<div class="hd"><b>Ensayo de tensión</b></div><div class="hd2">Tiempo del ensayo: <b id="t8">0,00 s</b> · reproducción: <b id="v8">× 1</b></div>
    <svg id="uni" width="810" height="150" viewBox="0 0 810 150"></svg>
    <div class="ct">Tensión en el punto de conexión (kV) <i style="background:${COL.elec}"></i>con AVR <i class="dash"></i>sin AVR</div><svg id="c8a" width="810" height="180" viewBox="0 0 810 180"></svg>
    <div class="ct">Potencia reactiva del generador (MVAr)</div><svg id="c8b" width="810" height="160" viewBox="0 0 810 160"></svg>
    <div class="row tiles"><div class="tile">Potencia activa<b id="r8a"></b></div><div class="tile">Potencia reactiva<b id="r8b"></b></div><div class="tile">Corriente de campo<b id="r8c"></b></div></div>`, S[8] + 3.6, S[9] - 0.5, 'left:1010px;top:96px;width:866px;', { weight: 2 });
  card(`<div class="two"><b style="color:${COL.mec}">Gobernador</b><span>agua → potencia activa (MW) y frecuencia</span></div>
    <div class="two"><b style="color:${COL.campo}">AVR</b><span>excitación → tensión y potencia reactiva (MVAr)</span></div>`, W(8, 5, 'el') - 0.2, S[9] - 0.5, 'left:44px;top:734px;width:930px;');
  // 9: closing phrases and credits
  const PHR = [['El agua aporta energía', COL.agua, W(9, 1, 'agua')], ['La máquina la transforma', COL.mec, W(9, 1, 'turbina')], ['Los controles permiten operar', COL.elec, W(9, 3, 'controles')]].map(([t, c, t0], i) => { const e = el('div', 'phr', t); e.style.borderLeftColor = c; e.style.top = 150 + i * 104 + 'px'; e.style.opacity = 0; return { el: e, t0 }; });
  card(`<h3>Del agua a la electricidad</h3><p>Modelo educativo; parámetros ilustrativos. No representa una central real.</p>
    <p class="dim sm">Referencia conceptual: animación de Luis Manuel Dután Amay, con diapositiva base de Daniel Kirschen. Modelos, ilustraciones, guion y cálculos originales, generados por código. Voz sintética.</p>`, T.fin0 + 3.8, T.fin + 1, 'left:56px;top:60px;width:1000px;');

  const $ = (id) => document.getElementById(id);
  const cues = []; for (const e of voz.escenas) for (const f of e.frases) for (const c of f.cortes) cues.push(c);
  let lastCue = null; sub.style.visibility = 'hidden';
  let measured = false;
  const measure = () => { for (const l of L) { l.w = l.el.offsetWidth; l.h = l.el.offsetHeight; } hb.forEach((e) => { e._w = e.offsetWidth; e._h = e.offsetHeight; }); measured = true; };
  const setTxt = (id, s) => { const e = $(id); if (e._s !== s) { e._s = s; e.textContent = tx(s); } };

  // ---------------------------------------------------------------- chart helpers
  const axes = (w, hh, x, y, xt, yt, xl, dec = 0) => {
    let s = `<rect x="64" y="8" width="${w - 76}" height="${hh - 46}" fill="rgba(160,200,235,.05)" stroke="rgba(160,200,235,.28)"/>`;
    for (const v of yt) s += `<line x1="64" x2="${w - 12}" y1="${f2(y(v))}" y2="${f2(y(v))}" stroke="rgba(160,200,235,.16)"/><text x="56" y="${f2(y(v) + 9)}" text-anchor="end" class="ax">${fmt(v, dec)}</text>`;
    for (const v of xt) s += `<line x1="${f2(x(v))}" x2="${f2(x(v))}" y1="${hh - 38}" y2="${hh - 32}" stroke="#b4c0cc"/><text x="${f2(x(v))}" y="${hh - 8}" text-anchor="middle" class="ax">${xl(v)}</text>`;
    return s;
  };
  const curve = (arr, dt, t0, t1, x, y, col, o = '') => { let d = ''; const i0 = Math.ceil(t0 / dt), i1 = Math.floor(t1 / dt); for (let i = i0; i <= i1; i++) d += (d ? 'L' : 'M') + f2(x(i * dt)) + ' ' + f2(y(arr[i])); if (t1 > i1 * dt) d += (d ? 'L' : 'M') + f2(x(t1)) + ' ' + f2(y(serie(arr, dt, t1))); return d ? `<path d="${d}" fill="none" stroke="${col}" stroke-width="4" stroke-linejoin="round" ${o}/>` : ''; };
  const cursor = (xx, hh) => `<line x1="${f2(xx)}" x2="${f2(xx)}" y1="8" y2="${hh - 38}" stroke="#f3f6f9" stroke-width="2" opacity=".8"/>`;

  function update(t, project, info) {
    if (!measured) measure();
    const n = clamp(S.findIndex((s, i) => i > 0 && t < S[i + 1]), 1, 9), esc = guion.escenas[n - 1], tl = t - S[n];
    let svg = '', count = 0;
    // chapter chip: first seconds of every scene after the first
    const ca = n === 1 ? 0 : env(tl, n >= 7 ? 3.5 : 0.3, n >= 7 ? 7.6 : 4.6, 0.35, 0.45);
    chip.style.opacity = f2(ca); if (ca > 0.5) count++;
    if (chip.dataset.n !== String(n)) { chip.dataset.n = n; chip.innerHTML = `<b>${String(n).padStart(2, '0')}</b>${esc.titulo}`; }
    const ta = env(t, 0.9, 6.6, 0.7, 0.6);
    title.style.opacity = f2(ta); title.style.transform = `translateY(${f2(14 * (1 - ss(0.9, 1.9, t)))}px)`; if (ta > 0.5) count++;
    const dips = Math.max(env(t, S[7] - 0.4, S[7] + 0.4, 0.38, 0.38), env(t, S[8] - 0.4, S[8] + 0.4, 0.38, 0.38), env(t, S[9] - 0.4, S[9] + 0.4, 0.38, 0.38));
    black.style.opacity = f2(Math.max(1 - t / 0.7, dips, ss(T.fin - 0.9, T.fin - 0.08, t)));
    let tg = null, tga = 0; for (const x of TAGS) { const a = env(t, x[1], x[2], 0.4, 0.4); if (a > tga) { tga = a; tg = x[0]; } }
    tagR.style.opacity = f2(tga); if (tg && tagR._s !== tg) { tagR._s = tg; tagR.textContent = tx(tg); }
    tagR.style.top = n === 6 ? '112px' : '36px';

    // labels
    for (const l of L) {
      const a = env(t, l.t0, l.t1, l.fast ? 0.15 : 0.35, l.fast ? 0.15 : 0.35);
      if (a <= 0.004) { if (l.shown) { l.el.style.opacity = 0; l.shown = false; } continue; }
      l.shown = true; if (a > 0.5) count++;
      let bx, by;
      if (l.at) { bx = l.at[0]; by = l.at[1]; }
      else {
        const p = project(l.a);
        bx = l.dx >= 0 ? p[0] + l.dx : p[0] + l.dx; by = p[1] + l.dy - l.h / 2;
        bx = clamp(bx, 36, (l.xmax || 1884) - l.w); by = clamp(by, 36, 930 - l.h);
        const ex = clamp(p[0], bx, bx + l.w), ey = clamp(p[1], by, by + l.h), ax = Math.abs(p[0] - ex) < 1 ? p[0] : ex, ay = Math.abs(p[0] - ex) < 1 ? ey : by + l.h / 2;
        svg += `<line x1="${f2(p[0])}" y1="${f2(p[1])}" x2="${f2(ax)}" y2="${f2(ay)}" opacity="${f2(a * 0.9)}"/><circle class="dot" cx="${f2(p[0])}" cy="${f2(p[1])}" r="5" opacity="${f2(a)}"/>`;
      }
      l.el.style.opacity = f2(a); l.el.style.left = f2(bx) + 'px'; l.el.style.top = f2(by) + 'px';
    }
    // cards
    for (const c of C) {
      const a = env(t, c.t0, c.t1, 0.5, 0.5);
      if (a <= 0.004) { if (c.shown) { c.el.style.opacity = 0; c.shown = false; } continue; }
      c.shown = true; c.el.style.opacity = f2(a); if (a > 0.5) count += c.weight || 1;
      for (const q of c.nodes) q.n.style.opacity = f2(ss(q.t, q.t + 0.4, t));
      for (const q of c.ck) q.n.style.setProperty('--k', f2(ss(q.t, q.t + 0.3, t)));
    }
    for (const x of TR) x.el.style.opacity = f2(env(t, x.t0, x.t1, 0.35, 0.45));
    for (const x of PHR) { const a = env(t, x.t0, T.fin0 + 0.5, 0.5, 0.6); x.el.style.opacity = f2(a); x.el.style.transform = `translateX(${f2(-18 * (1 - ss(x.t0, x.t0 + 0.6, t)))}px)`; if (a > 0.5) count++; }

    // 2: head bracket
    const ha = env(t, tH.g0, tH.end, 0.5, 0.5);
    if (ha > 0.004) {
      const xb = 19, top = project([xb, LAKE.y, 0]), bot = project([xb, RUN.y, 0]), lk = project([-98.4, LAKE.y, 0]), nz = project([9.5, RUN.y, 0]);
      const la = ss(tH.loss, tH.loss + 0.5, t), na = ss(tH.net, tH.net + 0.5, t), yl = top[1] + 54;              // schematic length of the loss segment
      svg += `<g opacity="${f2(ha)}"><line class="dsh" x1="${f2(lk[0])}" y1="${f2(lk[1])}" x2="${f2(top[0] + 40)}" y2="${f2(top[1])}"/><line class="dsh" x1="${f2(nz[0])}" y1="${f2(nz[1])}" x2="${f2(bot[0] + 40)}" y2="${f2(bot[1])}"/>
        <line x1="${f2(top[0])}" y1="${f2(top[1])}" x2="${f2(top[0])}" y2="${f2(bot[1])}" stroke-width="5" style="stroke:${na > 0.5 ? COL.agua : '#f3f6f9'}"/>
        <path d="M${f2(top[0] - 12)} ${f2(top[1] + 16)}L${f2(top[0])} ${f2(top[1])}L${f2(top[0] + 12)} ${f2(top[1] + 16)}M${f2(bot[0] - 12)} ${f2(bot[1] - 16)}L${f2(bot[0])} ${f2(bot[1])}L${f2(bot[0] + 12)} ${f2(bot[1] - 16)}" fill="none" stroke="#f3f6f9" stroke-width="4"/>
        <line x1="${f2(top[0])}" y1="${f2(top[1])}" x2="${f2(top[0])}" y2="${f2(yl)}" stroke-width="9" style="stroke:${COL.rojo}" opacity="${f2(la)}"/></g>`;
      const pos = [[top[0] + 34, (top[1] + bot[1]) / 2 - 150, ha * (1 - na)], [top[0] + 34, top[1] + 4, ha * la], [top[0] + 34, (top[1] + bot[1]) / 2 - 20, ha * na], [bot[0] + 34, bot[1] - 30, ha]];
      hb.forEach((e, i) => { e.style.left = f2(clamp(pos[i][0], 36, 1884 - e._w)) + 'px'; e.style.top = f2(pos[i][1]) + 'px'; e.style.opacity = f2(pos[i][2]); if (pos[i][2] > 0.5) count++; });
    } else hb.forEach((e) => { if (e.style.opacity !== '0') e.style.opacity = 0; });

    // 4: three sinusoids, slowed down exactly as the stator bars of the model
    if (wave.shown) {
      const th = (GEN.poles / 2) * info.theta, w = 800, mid = 125, amp = 96; let s = `<line x1="0" x2="${w}" y1="${mid}" y2="${mid}" stroke="rgba(160,200,235,.3)"/>`;
      [COL.L1, COL.L2, COL.L3].forEach((c, k) => {
        let d = ''; for (let i = 0; i <= 160; i++) { const x = (i / 160) * w, y = mid - amp * Math.sin(th - (k * 2 * Math.PI) / 3 - ((w * 0.72 - x) / w) * 4.4 * Math.PI); d += (i ? 'L' : 'M') + f2(x) + ' ' + f2(y); }
        const y0 = mid - amp * Math.sin(th - (k * 2 * Math.PI) / 3);
        s += `<path d="${d}" fill="none" stroke="${c}" stroke-width="4.5"/><circle cx="${w * 0.72}" cy="${f2(y0)}" r="9" fill="${c}"/><text x="${w * 0.72 + 22 + k * 62}" y="34" fill="${c}" class="axb">L${k + 1}</text>`;
      });
      $('wave').innerHTML = s + `<line x1="${w * 0.72}" x2="${w * 0.72}" y1="14" y2="236" stroke="#f3f6f9" stroke-width="2" opacity=".7"/>`;
    }
    // 5: phasors of generator and grid, and delivered power
    if (sync.shown) {
      const u = ss(S[5] + 1.5, tck[2] - 0.2, t), ang = -2.6 * (1 - u) * (1 - u), len = lerp(74, 100, ss(S[5] + 1.5, tck[0] - 0.3, t)); let s = `<circle r="104" fill="none" stroke="rgba(160,200,235,.25)"/>`;
      [COL.L1, COL.L2, COL.L3].forEach((c, k) => {
        const a0 = -Math.PI / 2 + (k * 2 * Math.PI) / 3, a1 = a0 + ang;
        s += `<line x2="${f2(100 * Math.cos(a0))}" y2="${f2(100 * Math.sin(a0))}" stroke="#f3f6f9" stroke-width="3" stroke-dasharray="7 7" opacity=".75"/><line x2="${f2(len * Math.cos(a1))}" y2="${f2(len * Math.sin(a1))}" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`;
      });
      $('phas').innerHTML = s;
      const mw = 30 * ss(T.close + 0.5, T.close + 5.2, t); setTxt('mw', fmt(mw) + ' MW'); $('mwbar').style.width = f2((mw / 30) * 100) + '%';
    }
    // 6: voltage levels
    const sa = env(t, S[6] + 4.6, S[7] - 0.5, 0.5, 0.5); strip.style.opacity = f2(sa); if (sa > 0.5) count++;
    if (sa > 0.004) lvEls.forEach((e, i) => { const on = t >= lvOn[4] ? 1 : env(t, lvOn[i], lvOn[i + 1], 0.3, 0.3); e.style.opacity = f2(lerp(0.42, 1, on)); e.style.borderColor = on > 0.5 ? COL.elec : 'rgba(160,200,235,.28)'; });

    // 7: frequency test
    if (p7.shown) {
      const tp = T.tph7(t), w = 810, hh = 215, x = (v) => 64 + (v <= 20 ? (v / 20) * 0.46 : 0.46 + ((v - 20) / 80) * 0.54) * (w - 76), xt = [0, 5, 10, 15, 20, 40, 60, 80, 100];
      const brk = `<path d="M${f2(x(20) - 5)} ${hh - 30}l5 -14M${f2(x(20) + 3)} ${hh - 30}l5 -14" stroke="#b4c0cc" stroke-width="2"/>`;
      const ya = (v) => 8 + (1 - (v - 19) / 5) * (hh - 46), yb = (v) => 8 + (1 - (v - 57.6) / 2.8) * (hh - 46);
      const ev = tp >= fr.t_evento ? `<line x1="${f2(x(fr.t_evento))}" x2="${f2(x(fr.t_evento))}" y1="8" y2="${hh - 38}" stroke="${COL.rojo}" stroke-width="2" stroke-dasharray="6 6"/>` : '';
      const ph = (a, b, c) => (tp > a ? `<rect x="${f2(x(a))}" y="${hh - 50}" width="${f2(x(Math.min(b, tp)) - x(a))}" height="12" fill="${c}" opacity=".85"/>` : '');
      $('c7a').innerHTML = axes(w, hh, x, ya, xt, [20, 22, 24], (v) => v) + brk + ev + curve(fr.Pe, fr.dt, 0, tp, x, ya, COL.elec) + curve(fr.Pm, fr.dt, 0, tp, x, ya, COL.mec) + cursor(x(tp), hh)
        + (tp > 10.3 ? `<text x="${f2(x(10.4))}" y="${f2(ya(23.35))}" class="ann">${tx('Aumento de demanda: +3 MW')}</text>` : '')
        + `<text x="${w - 20}" y="${f2(ya(19.35))}" text-anchor="end" class="ann" opacity="${f2(env(t, T.f.ev + 2.5, T.f.b, 0.4, 0.4))}">${tx('Inercia del agua: la potencia mecánica tarda')}</text>`;
      $('c7b').innerHTML = axes(w, hh, x, yb, xt, [58, 59, 60], (v) => v, 0) + brk + `<line x1="64" x2="${w - 12}" y1="${f2(yb(60))}" y2="${f2(yb(60))}" stroke="#f3f6f9" stroke-dasharray="4 6" opacity=".6"/>` + ev
        + ph(10, 14, COL.rojo) + ph(14, 44, COL.mec) + ph(44, 100, COL.elec) + curve(fr.f, fr.dt, 0, tp, x, yb, '#f3f6f9') + cursor(x(tp), hh);
      const pe = serie(fr.Pe, fr.dt, tp), pm = serie(fr.Pm, fr.dt, tp), ff = serie(fr.f, fr.dt, tp), g = serie(fr.aguja, fr.dt, tp), q = serie(fr.Q, fr.dt, tp);
      [...$('k7').parentNode.querySelectorAll('span')].forEach((e, i) => (e.style.opacity = tp > [10, 14, 44][i] ? 1 : 0.35));
      setTxt('t7', fmt(tp) + ' s'); setTxt('v7', T.vel7(t)); setTxt('r7a', fmt(pe) + ' MW'); setTxt('r7b', fmt(pm) + ' MW'); setTxt('r7c', fmt(ff, 2) + ' Hz');
      setTxt('g7', fmt(g * 100) + ' %'); setTxt('q7', fmt(q, 2) + ' m³/s'); setTxt('n7', Math.round((ff / par.maquina.frecuencia_Hz) * der.velocidad_sincronica_rpm) + ' rpm');
    }
    // 8: voltage test
    if (p8.shown) {
      const tp = T.tph8(t), w = 810, x = (v) => 64 + ((v - 1.95) / 0.5) * (w - 76), xt = [2.0, 2.1, 2.2, 2.3, 2.4], on = tp >= te.t_evento, tv = Math.max(1.95, tp);
      const ya = (v) => 8 + (1 - (v - 206) / 24) * (180 - 46), yb = (v) => 8 + (1 - v / 16) * (160 - 46), lim = te.resumen.Q_a_factor_de_potencia_nominal_MVAr;
      const ev = (hh) => (on ? `<line x1="${f2(x(2))}" x2="${f2(x(2))}" y1="8" y2="${hh - 38}" stroke="${COL.rojo}" stroke-width="2" stroke-dasharray="6 6"/>` : '');
      $('c8a').innerHTML = axes(w, 180, x, ya, xt, [210, 220, 230], (v) => fmt(v, 1)) + ev(180) + curve(te.Vp_sin, te.dt, 1.95, tv, x, ya, '#b4c0cc', 'stroke-dasharray="9 8"') + curve(te.Vp, te.dt, 1.95, tv, x, ya, COL.elec) + cursor(x(tv), 180)
        + `<text x="${w - 20}" y="${f2(ya(208.6))}" text-anchor="end" class="ann" opacity="${f2(ss(2.25, 2.3, tp))}">${tx('Sin AVR seguiría bajando hasta ≈ ')}${fmt(te.resumen.final_sin_AVR_excitacion_fija.V_conexion_kV, 0)} kV</text>`;
      $('c8b').innerHTML = axes(w, 160, x, yb, xt, [0, 8, 16], (v) => fmt(v, 1)) + ev(160) + `<line x1="64" x2="${w - 12}" y1="${f2(yb(lim))}" y2="${f2(yb(lim))}" stroke="${COL.rojo}" stroke-width="2.5" stroke-dasharray="10 6"/><text x="${w - 18}" y="${f2(yb(lim) + 26)}" text-anchor="end" class="ann" opacity="${f2(ss(W(8, 4, 'limitada') - 0.3, W(8, 4, 'limitada') + 0.3, t))}">${tx('Límite a factor de potencia nominal: ')}${fmt(lim)} MVAr</text>`
        + curve(te.Qg, te.dt, 1.95, tv, x, yb, COL.campo) + cursor(x(tv), 160);
      const cq = on ? COL.rojo : '#b4c0cc';
      $('uni').innerHTML = `<g fill="none" stroke="#f3f6f9" stroke-width="3"><circle cx="46" cy="70" r="26"/><line x1="72" x2="150" y1="70" y2="70"/><circle cx="170" cy="70" r="20"/><circle cx="196" cy="70" r="20"/><line x1="216" x2="600" y1="70" y2="70"/><line x1="300" x2="300" y1="46" y2="94" stroke-width="7"/>
        <rect x="420" y="56" width="96" height="28" fill="#0b1119"/><line x1="600" x2="600" y1="40" y2="100" stroke-width="7"/><line x1="300" x2="300" y1="94" y2="124" stroke="${cq}"/><path d="M290 116l10 14l10 -14" stroke="${cq}"/></g>
        <text x="46" y="80" text-anchor="middle" class="axb">G</text><text x="300" y="28" text-anchor="middle" class="ax">${tx('punto de conexión (230 kV)')}</text><text x="468" y="116" text-anchor="middle" class="ax">${tx('impedancia de red')}</text><text x="616" y="80" class="ax">${tx('@red')}</text>
        <text x="282" y="120" text-anchor="end" class="ax" style="fill:${cq}">${tx('carga reactiva')}</text><text x="282" y="148" text-anchor="end" class="ax" style="fill:${cq}">${on ? '+' + fmt(par.ensayo_tension.carga_reactiva_final_MVAr - par.ensayo_tension.carga_reactiva_inicial_MVAr, 0) + ' MVAr' : ''}</text>`;
      setTxt('t8', fmt(tp, 2) + ' s'); setTxt('v8', T.vel8(t)); setTxt('r8a', fmt(par.ensayo_tension.P_MW) + ' MW'); setTxt('r8b', fmt(serie(te.Qg, te.dt, tp)) + ' MVAr'); setTxt('r8c', fmt(serie(te.If, te.dt, tp), 2) + ' pu');
    }
    lines.innerHTML = svg;

    // subtitles (text of the real audio): interactive preview, or ?subs=1
    if (showSubs) { const cue = cues.find((c) => t >= c.ini && t < c.fin) || null; if (cue !== lastCue) { lastCue = cue; sub.textContent = cue ? cue.texto : ''; sub.style.visibility = cue ? 'visible' : 'hidden'; } }
    const tr = Math.max(...TR.map((x) => env(t, x.t0, x.t1, 0.35, 0.45)));
    return { labels: count, scene: n, dim: 1 - 0.55 * tr };
  }
  return { update, measure, labels: L };
}
