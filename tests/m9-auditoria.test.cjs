const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {JSDOM, VirtualConsole} = require('jsdom');
const root = path.resolve(__dirname, '..');
const current = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const previous = execFileSync('git', ['show', '26ecc91ef16f7bca9e625fff1425a2f1d89129a3:index.html'],
  {cwd:root, encoding:'utf8', maxBuffer:20e6});

function app(html = current) {
  const errors = [], vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html.replace(/var ASSUR_M9_LOG_URL = '[^']*';/, "var ASSUR_M9_LOG_URL = '';"), {
    url:'https://calculadora.assur.mx/', runScripts:'dangerously', virtualConsole:vc,
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = () => ({});
      w.Chart = class {destroy() {} update() {}};
      w.alert = message => errors.push('alert: ' + message);
      w.fetch = () => { throw new Error('Telemetría no permitida en QA'); };
    }
  });
  return {w:dom.window, errors, close:() => dom.window.close()};
}
function set(a, id, value) { a.w.document.getElementById(id).value = String(value); }
function state(a) { return JSON.parse(a.w.eval('JSON.stringify(STATE.m9)')); }
function scenario(a, modelo = 'imt665', dn = 610, hr = 2.2) {
  for(const [id,v] of Object.entries({'m9-dn':dn,'m9-hr':hr,'m9-b':3,'m9-fa':2.3,
    'm9-bfll':1.5,'m9-gamma':19.2,'m9-lamu':.165,'m9-gamseg':1.5,'m9-tipo':'zanja',
    'm9-trafico':modelo})) set(a,id,v);
  a.w.document.getElementById('m9-lrfd-toggle').checked = false;
  a.w.m9ParedB(); a.w.m9SyncTrafico();
  return state(a);
}

test('Las cuatro funciones base de carga y clasificación permanecen idénticas', () => {
  const a=app(), b=app(previous);
  for(const fn of ['m9CalcCargaRelleno','m9CalcLRFD_IMT','calcLRFD_qL','m9ClasificarReforzado'])
    assert.equal(a.w[fn].toString(),b.w[fn].toString(),fn);
  a.close(); b.close();
});

for(const modelo of ['imt665','imt665c','imt205']) {
  test(modelo + ': DN y espesor actualizan el preset sin reactivar el selector', () => {
    const a=app();
    scenario(a,modelo);
    set(a,'m9-dn',1830); a.w.m9ParedB(); a.w.calcM9();
    const resultado = state(a);
    const preset = +a.w.document.getElementById('m9-q-traf').value;
    a.w.m9SyncTrafico();
    assert.equal(state(a).qCalc,resultado.qCalc);
    assert.equal(state(a).grado,resultado.grado);
    assert.equal(preset,+a.w.m9CalcLRFD_IMT(1,1830,178,modelo).qL.toFixed(1));
    set(a,'m9-espesor',200.4); a.w.calcM9();
    assert.equal(+a.w.document.getElementById('m9-q-traf').value,
      +a.w.m9CalcLRFD_IMT(1,1830,200,modelo).qL.toFixed(1));
    assert.equal(state(a).espesor,200);
    assert.deepEqual(a.errors,[]);
    console.log(JSON.stringify({modelo,preset,qCalc:resultado.qCalc,grado:resultado.grado}));
    a.close();
  });
}

test('Regresión documentada: 106.2 a111.5 kN/m corrige Grado3 a4', () => {
  const viejo=app(previous), nuevo=app();
  scenario(viejo); scenario(nuevo);
  for(const a of [viejo,nuevo]) { set(a,'m9-dn',1830); a.w.m9ParedB(); a.w.calcM9(); }
  assert.equal(state(viejo).grado,'3');
  assert.equal(state(nuevo).grado,'4');
  assert.equal(state(nuevo).qTrafPreset,111.5);
  assert.ok(Math.abs(state(nuevo).qCalc-101.0402951673)<1e-8);
  console.log(JSON.stringify({antes:state(viejo).qCalc,despues:state(nuevo).qCalc}));
  viejo.close(); nuevo.close();
});

for(const modelo of ['96','0','120','custom']) {
  test('Regresión carga '+modelo+' sin alterar resultados NMX/LRFD', () => {
    const a=app(), b=app(previous);
    scenario(a,modelo,1070,2); scenario(b,modelo,1070,2);
    if(modelo==='custom') for(const x of [a,b]) {set(x,'m9-q-traf',77.7); x.w.calcM9();}
    for(const mode of [false,true]) {
      for(const x of [a,b]) {x.w.document.getElementById('m9-lrfd-toggle').checked=mode; x.w.calcM9();}
      for(const key of ['qCalc','qTotal','qr','grado','Fa','gamSeg'])
        assert.equal(state(a)[key],state(b)[key],key);
    }
    if(modelo==='custom') {
      set(a,'m9-dn',1830); a.w.m9ParedB(); a.w.calcM9();
      assert.equal(+a.w.document.getElementById('m9-q-traf').value,77.7);
    }
    a.close(); b.close();
  });
}

test('IMT con LRFD usa la cobertura real, no el preset de referencia', () => {
  const a=app(); scenario(a,'imt665',1830,3);
  a.w.document.getElementById('m9-lrfd-toggle').checked=true; a.w.calcM9();
  const r=state(a);
  assert.equal(r.qTrafEfectiva,a.w.m9CalcLRFD_IMT(3,1830,178,'imt665').qL);
  assert.notEqual(r.qTrafEfectiva,r.qTrafPreset);
  a.close();
});

function comprobarModoReportado(a, seleccionado, aplicado, modo) {
  const r=state(a);
  assert.equal(r.useLRFD,seleccionado,'El checkbox conserva la selección');
  assert.equal(r.lrfdAplicado,aplicado,'El estado distingue la aplicación efectiva');
  assert.equal(a.w.m9FilasTrazabilidad(r).find(f=>f[0]==='Modo')[1],modo);
  a.w.actualizarReporte();
  assert.ok(a.w.document.getElementById('rep-m9-sict').textContent.includes('Modo: '+modo));
  const lines=[];
  const doc={setTextColor(){},setFont(){},setFontSize(){},addPage(){},
    splitTextToSize(t){return [t];},text(t){lines.push(t);}};
  a.w.pdfM9SICT(doc,r,20,210,15,[0,0,0]);
  assert.ok(lines.includes('Modo: '+modo),'La trazabilidad PDF coincide con la pantalla');
  // Evaluar las filas reales del exportador, no una copia de su condición.
  const filas=current.match(/var rowsM9 = (\[[\s\S]*?\n    \]);/);
  assert.ok(filas,'La tabla M9 debe existir en generarPDF');
  const rows=a.w.eval('(function(m9p){return '+filas[1]+';})(STATE.m9)');
  assert.equal(rows.find(f=>f[0]==='Modo LRFD aplicado')[1],aplicado?'Sí':'No');
  assert.deepEqual(a.errors,[]);
}

for(const modelo of ['50','80','0']) {
  for(const seleccionado of [false,true]) {
    test('Modo reportado '+modelo+': LRFD seleccionado='+seleccionado+' pero no aplicado',()=>{
      const a=app();
      try {
        scenario(a,modelo,1070,3);
        const antes=state(a);
        a.w.document.getElementById('m9-lrfd-toggle').checked=seleccionado;
        a.w.calcM9();
        comprobarModoReportado(a,seleccionado,false,seleccionado
          ? 'LRFD seleccionado, no aplicable a esta carga'
          : 'Conservador (sin LRFD)');
        const despues=state(a);
        for(const key of ['qTrafPreset','qTrafEfectiva','qCalc','qTotal','qr','grado'])
          assert.equal(despues[key],antes[key],key+' no cambia sin aplicación LRFD');
      } finally { a.close(); }
    });
  }
}

for(const modelo of ['imt665','imt665c','imt205','96','custom']) {
  for(const seleccionado of [false,true]) {
    test('Modo reportado '+modelo+': LRFD aplicado solo con selección activa='+seleccionado,()=>{
      const a=app();
      try {
        scenario(a,modelo,1070,3);
        if(modelo==='custom') {set(a,'m9-q-traf',77.7); a.w.calcM9();}
        a.w.document.getElementById('m9-lrfd-toggle').checked=seleccionado;
        a.w.calcM9();
        comprobarModoReportado(a,seleccionado,seleccionado,seleccionado
          ? 'LRFD a cobertura real'
          : modelo.startsWith('imt') ? 'Conservador (IMT: referencia a 1 m)'
          : 'Conservador (sin LRFD)');
        const r=state(a);
        const carga=seleccionado ? (modelo.startsWith('imt')
          ? a.w.m9CalcLRFD_IMT(3,1070,r.espesor,modelo).qL
          : a.w.calcLRFD_qL(3,1070,r.espesor,142.3).qL) : r.qTrafPreset;
        assert.equal(r.qTrafEfectiva,carga,'La carga efectiva corresponde al modo aplicado');
      } finally { a.close(); }
    });
  }
}

test('Cambio IMT → FAA → IMT no deja el modo reportado obsoleto',()=>{
  const a=app();
  try {
    scenario(a,'imt665',1070,3);
    a.w.document.getElementById('m9-lrfd-toggle').checked=true;
    a.w.calcM9();
    comprobarModoReportado(a,true,true,'LRFD a cobertura real');
    set(a,'m9-trafico','50'); a.w.m9SyncTrafico();
    comprobarModoReportado(a,true,false,'LRFD seleccionado, no aplicable a esta carga');
    set(a,'m9-trafico','imt665'); a.w.m9SyncTrafico();
    comprobarModoReportado(a,true,true,'LRFD a cobertura real');
    a.w.document.getElementById('m9-lrfd-toggle').checked=false; a.w.calcM9();
    comprobarModoReportado(a,false,false,'Conservador (IMT: referencia a 1 m)');
  } finally { a.close(); }
});

test('Carga personalizada cero con LRFD seleccionado no se reporta como aplicado',()=>{
  const a=app();
  try {
    scenario(a,'custom',1070,3);
    set(a,'m9-q-traf',0);
    a.w.document.getElementById('m9-lrfd-toggle').checked=true; a.w.calcM9();
    comprobarModoReportado(a,true,false,'LRFD seleccionado, no aplicable a esta carga');
    assert.equal(state(a).qTrafEfectiva,0);
  } finally { a.close(); }
});

for(const suelo of ['CH','MH','OH','OL','Pt','SC']) {
  test('Suelo '+suelo+': ayuda y checklist comparten la misma evaluación', () => {
    const a=app(); scenario(a); set(a,'m9-suelo-fondo',suelo); a.w.calcM9();
    const ayuda=a.w.document.getElementById('m9-suelo-info').textContent;
    const item=state(a).sict.items.find(i=>i.clausula==='SUCS / G.3');
    assert.equal(item.texto,ayuda);
    assert.doesNotMatch(ayuda,/profundizar.*20|compactar el fondo al 95|Sin capa de cimentaci/i);
    assert.match(ayuda,/proyecto|Secretaría/);
    if(suelo==='OL') assert.equal(item.estado,'warn');
    a.close();
  });
}

test('f’c: 34.5MPa excede350kg/cm² sin tolerancia ni certificación', () => {
  const a=app(); scenario(a);
  const ctx={DN:1830,hr:2.2,b:3,Bc:2.186,Fa:2.3,qTraf:111.5,qCalc:98,esZanja:true,
    suelo:'SC',traficoTipo:'imt665',esIMT:true,grado:'3',fcMPa:34.5,fcMax:350};
  const r=a.w.m9VerificarSICT(ctx);
  const i=r.items.find(i=>i.clausula==='Comparación numérica');
  assert.equal(i.estado,'warn');
  assert.match(i.texto,/351.80/);
  assert.doesNotMatch(i.texto,/Conforme al concepto contratado|tolerancia ±2/);
  ctx.fcMax=400;
  assert.equal(a.w.m9VerificarSICT(ctx).items.find(i=>i.clausula==='Comparación numérica').estado,'info');
  ctx.fcMax=0;
  assert.match(a.w.m9VerificarSICT(ctx).items.find(i=>i.clausula==='Clase 3').texto,/Sin referencia/);
  a.close();
});

test('Reporte y PDF preservan instantánea, avisos y saltos de página', () => {
  const a=app(); scenario(a,'imt665',1830); set(a,'m9-suelo-fondo','OL');
  set(a,'m9-fc-max',350); a.w.calcM9();
  const r=state(a);
  a.w.actualizarReporte();
  const texto=a.w.document.getElementById('rep-m9-sict').textContent;
  assert.match(texto,/IMT 66.5/); assert.match(texto,/OL/); assert.match(texto,/351|422/);
  for(const item of r.sict.items) assert.ok(texto.includes(item.texto));
  let pages=0; const lines=[];
  const doc={setTextColor(){},setFont(){},setFontSize(){},addPage(){pages++;},
    splitTextToSize(t){return t.match(/.{1,85}/g)||[];},
    text(t,x,y){assert.ok(y<=268); lines.push(t);}};
  a.w.pdfM9SICT(doc,r,260,210,15,[0,0,0]);
  assert.ok(pages>=1);
  assert.match(lines.join(' '),/Referencia de plantilla G.3/);
  assert.deepEqual(a.errors,[]);
  a.close();
});
