// On-screen text in other languages. The graphic layer is written in Spanish; makeTx('en')
// returns a function that replaces each Spanish phrase by its English counterpart. Keys are whole
// phrases (with their mark-up when a short word could be ambiguous) and are applied longest first.
const EN = [
  ['<h1>Del agua<br>a la <em>electricidad</em></h1>', '<h1>From water<br>to <em>electricity</em></h1>'],
  ['Central hidroeléctrica con turbina Pelton y generador síncrono', 'Hydroelectric plant with a Pelton turbine and a synchronous generator'],
  // tags
  ['Esquema espacial simplificado', 'Simplified spatial layout'], ['Caso ilustrativo', 'Illustrative case'],
  ['Movimiento ralentizado para explicación · velocidad real: 360 rpm', 'Motion slowed down for explanation · actual speed: 360 rpm'],
  ['Eleva tensión; no crea energía', 'It raises voltage; it does not create energy'],
  ['Ensayo ilustrativo · sistema equivalente aislado', 'Illustrative test · isolated equivalent system'],
  ['Ensayo ilustrativo · red de impedancia finita', 'Illustrative test · finite-impedance grid'],
  ['Modelo educativo · parámetros ilustrativos', 'Educational model · illustrative parameters'],
  // labels
  ['Energía hidráulica', 'Hydraulic energy'], ['Movimiento mecánico', 'Mechanical motion'], ['Electricidad', 'Electricity'],
  ['Caudal de diseño: ', 'Design flow: '], ['Presión antes de la boquilla ≈ ', 'Pressure ahead of the nozzle ≈ '], ['El agua conserva su presión en la tubería', 'Water keeps its pressure along the penstock'],
  ['Boquilla y aguja', 'Nozzle and needle'], ['Chorro ≈ ', 'Jet ≈ '], ['Cucharas dobles<small>con divisor central</small>', 'Double buckets<small>with a central splitter</small>'],
  ['Par sobre el rodete', 'Torque on the runner'], ['Eje<small>Potencia mecánica hacia el generador</small>', 'Shaft<small>Mechanical power to the generator</small>'],
  ['Canal de restitución<small>Descarga a presión atmosférica</small>', 'Tailrace<small>Discharge at atmospheric pressure</small>'],
  ['Rotor<small>Gira con la turbina</small>', 'Rotor<small>Turns with the turbine</small>'], ['Polos con excitación<small>de corriente continua</small>', 'Poles excited<small>with direct current</small>'],
  ['Campo magnético<small>Representación conceptual</small>', 'Magnetic field<small>Conceptual representation</small>'], ['Estator<small>Devanados fijos</small>', 'Stator<small>Fixed windings</small>'],
  ['Entrehierro', 'Air gap'], ['Interruptor abierto<small>Hay tensión; aún no hay corriente hacia la red</small>', 'Breaker open<small>Voltage is present; no current flows to the grid yet</small>'],
  ['Interruptor de generador<small>Abierto</small>', 'Generator breaker<small>Open</small>'], ['Interruptor de generador<small>Cerrado: entrega potencia</small>', 'Generator breaker<small>Closed: delivering power</small>'],
  ['Par hidráulico y par electromagnético<small>El segundo se opone al giro</small>', 'Hydraulic and electromagnetic torque<small>The second opposes rotation</small>'],
  ['Subestación reductora', 'Step-down substation'], ['Subestación de distribución', 'Distribution substation'], ['Transformador de distribución', 'Distribution transformer'],
  [' kV fase-neutro → 120/240 V', ' kV phase-to-neutral → 120/240 V'], ['Acometida<small>Dos fases y neutro</small>', 'Service drop<small>Two live conductors and neutral</small>'],
  ['Maniobra, medición y protección<small>en cada nivel de tensión</small>', 'Switching, metering and protection<small>at every voltage level</small>'],
  ['Señal del gobernador<small>Servomotor y aguja del inyector</small>', 'Governor signal<small>Servomotor and injector needle</small>'],
  ['Regulador automático de tensión', 'Automatic voltage regulator'], ['Excitación del rotor<small>Corriente de campo: ', 'Rotor excitation<small>Field current: '],
  ['Salto bruto ', 'Gross head '], ['Pérdidas en la conducción: ', 'Conduit losses: '], ['Salto neto ', 'Net head '], ['Nivel de los inyectores', 'Injector level'],
  // cards
  ['Potencia eléctrica en bornes', 'Electrical power at the terminals'], ['pérdidas de turbina y generador', 'turbine and generator losses'],
  ['Tensión inducida en el estator', 'Voltage induced in the stator'], ['Tres fases desfasadas 120°', 'Three phases, 120° apart'], ['Ondas ralentizadas · frecuencia real: ', 'Waves slowed down · actual frequency: '],
  ['f = polos × rpm / 120', 'f = poles × rpm / 120'], ['Antes de conectar', 'Before connecting'], ['</i>Tensión</div>', '</i>Voltage</div>'], ['</i>Frecuencia</div>', '</i>Frequency</div>'],
  ['Ángulo y secuencia<br>de fases', 'Phase angle<br>and sequence'], ['Continua: generador · trazos: red', 'Solid: generator · dashed: grid'], ['Potencia entregada: ', 'Power delivered: '],
  ['Misma potencia, menor corriente', 'Same power, less current'], ['30 MW a ', '30 MW at '], ['Factor de potencia 1 y sin pérdidas, para comparar', 'Unity power factor and no losses, for comparison'],
  ['<b>Transmisión</b>', '<b>Transmission</b>'], ['<b>Subtransmisión</b>', '<b>Subtransmission</b>'], ['<b>Media tensión</b>', '<b>Medium voltage</b>'], ['<b>Baja tensión</b>', '<b>Low voltage</b>'],
  ['<small>Ensayo ilustrativo</small>', '<small>Illustrative test</small>'], ['Respuesta de frecuencia', 'Frequency response'], ['Sistema equivalente aislado', 'Isolated equivalent system'],
  ['Respuesta de tensión', 'Voltage response'], ['Conectado a una red de impedancia finita', 'Connected to a finite-impedance grid'],
  ['<b>Ensayo de frecuencia</b>', '<b>Frequency test</b>'], ['<b>Ensayo de tensión</b>', '<b>Voltage test</b>'], ['Tiempo del ensayo: ', 'Test time: '], [' · reproducción: ', ' · playback: '],
  ['Potencia (MW) ', 'Power (MW) '], ['</i>demanda ', '</i>demand '], ['</i>potencia mecánica</div>', '</i>mechanical power</div>'], ['Frecuencia (Hz) ', 'Frequency (Hz) '],
  ['</i>inercia</span>', '</i>inertia</span>'], ['</i>primaria</span>', '</i>primary</span>'], ['</i>secundaria</span>', '</i>secondary</span>'],
  ['Demanda<b', 'Demand<b'], ['Potencia mecánica<b', 'Mechanical power<b'], ['Frecuencia<b', 'Frequency<b'], ['Apertura de aguja<b', 'Needle opening<b'], ['Caudal<b', 'Flow<b'], ['Velocidad<b', 'Speed<b'],
  ['Movimiento de la aguja ampliado × 3. Una unidad sola y aislada: la desviación es mayor que en un sistema interconectado.', 'Needle travel magnified × 3. A single isolated unit: the deviation is larger than in an interconnected system.'],
  ['Tensión en el punto de conexión (kV) ', 'Connection-point voltage (kV) '], ['</i>con AVR ', '</i>with AVR '], ['</i>sin AVR</div>', '</i>without AVR</div>'],
  ['Potencia reactiva del generador (MVAr)', 'Generator reactive power (MVAr)'], ['Potencia activa<b', 'Active power<b'], ['Potencia reactiva<b', 'Reactive power<b'], ['Corriente de campo<b', 'Field current<b'],
  ['>Gobernador</b>', '>Governor</b>'], ['agua → potencia activa (MW) y frecuencia', 'water → active power (MW) and frequency'], ['excitación → tensión y potencia reactiva (MVAr)', 'excitation → voltage and reactive power (MVAr)'],
  ['El agua aporta energía', 'Water supplies energy'], ['La máquina la transforma', 'The machine transforms it'], ['Los controles permiten operar', 'Controls make operation possible'],
  ['<h3>Del agua a la electricidad</h3>', '<h3>From water to electricity</h3>'], ['Modelo educativo; parámetros ilustrativos. No representa una central real.', 'Educational model; illustrative parameters. It does not represent a real plant.'],
  ['Referencia conceptual: animación de Luis Manuel Dután Amay, con diapositiva base de Daniel Kirschen. Modelos, ilustraciones, guion y cálculos originales, generados por código. Voz sintética.',
    'Conceptual reference: animation by Luis Manuel Dután Amay, based on a slide by Daniel Kirschen. Original models, illustrations, script and calculations, generated by code. Synthetic voice.'],
  // chart annotations and one-line diagram
  ['Aumento de demanda: +3 MW', 'Demand increase: +3 MW'], ['Inercia del agua: la potencia mecánica tarda', 'Water inertia: mechanical power lags'],
  ['Sin AVR seguiría bajando hasta ≈ ', 'Without AVR it would keep falling to ≈ '], ['Límite a factor de potencia nominal: ', 'Limit at rated power factor: '],
  ['punto de conexión (230 kV)', 'connection point (230 kV)'], ['impedancia de red', 'grid impedance'], ['carga reactiva', 'reactive load'], ['@red', 'grid'], ['detenido', 'stopped'],
].sort((a, b) => b[0].length - a[0].length);

export function makeTx(lang) {
  if (lang !== 'en') return (s) => String(s).replace('@red', 'red');
  return (s) => { s = String(s); for (const [a, b] of EN) if (s.includes(a)) s = s.split(a).join(b); return s; };
}
