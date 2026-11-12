const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const sourcePath=process.env.ASSUR_QA_HTML
  ? path.resolve(process.env.ASSUR_QA_HTML) : path.resolve(__dirname,'../../index.html');
const html=fs.readFileSync(sourcePath,'utf8')
  .replace(/var ASSUR_M9_LOG_URL = '[^']*';/,"var ASSUR_M9_LOG_URL = '';");
const target='http://assur-reportes.test/';
const chart=path.join(path.dirname(require.resolve('chart.js')),'chart.umd.js');
const jspdf=require.resolve('jspdf/dist/jspdf.umd.min.js');
const modules=[
  ['M1','caudal','caudal','calcCaudal'],
  ['M2','canal','canal','calcCanal'],
  ['M3','manning','manning','calcManning'],
  ['M4','pozos','pozos','calcPozos'],
  ['M5','perfil','perfilData','calcPerfil'],
  ['M6','agua','agua','calcAgua'],
  ['M7','sanitario','sanitario','calcSanitario'],
  ['M8','instalacion','instalacion',null],
  ['M9','disenio-concreto','m9','calcM9'],
  ['M10','jacking','m10','calcM10']
];

test.beforeEach(async({page})=>{
  page.__reportErrors=[]; page.__reportPosts=[];
  page.on('pageerror',e=>page.__reportErrors.push(e.message));
  await page.route('**/*',route=>{
    const req=route.request(),url=req.url();
    if(req.method()==='POST') page.__reportPosts.push(url);
    if(url===target) return route.fulfill({contentType:'text/html',body:html});
    if(url.includes('chart.umd.min.js')) return route.fulfill({path:chart,contentType:'text/javascript'});
    if(url.includes('jspdf.umd.min.js')) return route.fulfill({path:jspdf,contentType:'text/javascript'});
    return route.abort();
  });
  await page.goto(target,{waitUntil:'load'});
  await page.evaluate(()=>{
    for(const key of Object.keys(STATE)) STATE[key]=null;
    // No registrar datos de pruebas ni descargar al equipo del usuario.
    window.assurLogReporte=()=>{};
    const PDF=window.jspdf.jsPDF;
    window.jspdf.jsPDF=function(...args){
      const doc=new PDF(...args),text=doc.text.bind(doc),calls=[];
      doc.text=function(t,x,y,options){
        calls.push({text:t,x,y,options,page:doc.getNumberOfPages(),
          widths:(Array.isArray(t)?t:[t]).map(v=>doc.getTextWidth(String(v))),
          lineHeight:doc.getFontSize()/doc.internal.scaleFactor*doc.getLineHeightFactor()});
        return text(t,x,y,options);
      };
      doc.save=function(name){
        window.__reportPDF={name,calls,pages:doc.getNumberOfPages(),
          bytes:Array.from(new Uint8Array(doc.output('arraybuffer')))};
      };
      return doc;
    };
  });
});
test.afterEach(async({page})=>{
  expect(page.__reportErrors).toEqual([]);
  expect(page.__reportPosts).toEqual([]);
});

async function calculate(page,module){
  const [,tab,,fn]=module;
  await page.locator(`.tab-btn[onclick="showTab('${tab}')"]`).click();
  if(fn) await page.locator(`#sec-${tab} button[onclick="${fn}()"]`).click();
  else await page.locator('#inst-prof').fill('2.7');
}
async function exportPDF(page){
  await page.locator('.tab-btn[onclick="showTab(\'reporte\')"]').click();
  await page.getByRole('button',{name:'📄 Descargar PDF',exact:true}).click();
  await page.locator('#pdf-nombre').fill('QA ASSUR');
  await page.locator('#pdf-tel').fill('0000000000');
  await page.locator('#pdf-correo').fill('qa@example.invalid');
  await page.getByRole('button',{name:'📥 Generar PDF',exact:true}).click();
  const pdf=await page.evaluate(()=>window.__reportPDF);
  expect(pdf).toBeTruthy();
  expect(Buffer.from(pdf.bytes).subarray(0,5).toString()).toBe('%PDF-');
  return pdf;
}
function pdfLines(pdf){return pdf.calls.flatMap(c=>Array.isArray(c.text)?c.text:[c.text]);}

for(const module of modules){
  test(`${module[0]}: cálculo real incluido individualmente en reporte, impresión y PDF`,async({page})=>{
    await calculate(page,module);
    expect(await page.evaluate(key=>!!STATE[key],module[2])).toBe(true);
    const pdf=await exportPDF(page),lines=pdfLines(pdf);
    expect(lines.some(t=>t.startsWith(module[0]+'. '))).toBe(true);
    // No confundir el índice de cobertura con una sección de resultados.
    expect(lines.filter(t=>/^M\d+\.\s/.test(t))).toHaveLength(1);
    await expect(page.locator('#rep-modulos tr')).toHaveCount(10);
    await expect(page.locator('#rep-modulos')).toContainText(module[0]);
    expect(await page.locator('#rep-modulos tr').filter({hasText:'Calculado · incluido'}).count()).toBe(1);
    await page.emulateMedia({media:'print'});
    await expect(page.locator('#sec-reporte')).toBeVisible();
    await expect(page.locator(`#sec-${module[1]}`)).toBeHidden();
    await expect(page.getByRole('button',{name:'📄 Descargar PDF',exact:true})).toBeHidden();
    expect(lines.filter(t=>/\bundefined\b|\bNaN\b|\bInfinity\b/.test(t))).toEqual([]);
  });
}

test('M1–M10 juntos: datos coinciden, PDF paginado y textos dentro de A4',async({page},testInfo)=>{
  for(const module of modules) await calculate(page,module);
  const pdf=await exportPDF(page),lines=pdfLines(pdf);
  for(const [id] of modules) expect(lines.some(t=>t.startsWith(id+'. '))).toBe(true);
  expect(lines.filter(t=>/^M\d+\.\s/.test(t)).map(t=>t.split('.')[0]))
    .toEqual(modules.map(m=>m[0]));
  const expected=await page.evaluate(()=>[
    STATE.caudal.Q.toFixed(2)+' l/s',
    STATE.canal.sel.hid.Q.toFixed(1)+' l/s',
    STATE.manning.S_min_pct.toFixed(3)+'%',
    STATE.pozos.pozoInfo.tipo,
    (STATE.perfilData.S_dis*100).toFixed(3)+' %',
    STATE.agua.hf100.toFixed(3)+' m/100m',
    STATE.sanitario.Qext.toFixed(3)+' l/s',
    parseFloat(STATE.instalacion.defl).toFixed(2)+' % ('+parseFloat(STATE.instalacion.deflMm).toFixed(1)+' mm)',
    STATE.m9.qCalc.toFixed(2)+' N/m/mm',
    STATE.m10.Pmax_kN.toFixed(1)+' kN'
  ]);
  const contents=lines.join(' ').replace(/\s+/g,' ');
  for(const value of expected) expect(contents).toContain(value);
  expect(lines.filter(t=>/\bundefined\b|\bNaN\b|\bInfinity\b/.test(t))).toEqual([]);
  const overflows=[];
  for(const c of pdf.calls){
    const align=c.options?.align||'left',max=Math.max(...c.widths);
    const left=align==='center'?c.x-max/2:align==='right'?c.x-max:c.x;
    const right=left+max;
    if(left<0||right>210.2||c.y<0||c.y+(c.widths.length-1)*c.lineHeight>297)
      overflows.push({text:c.text,left,right,y:c.y,page:c.page});
  }
  expect(overflows).toEqual([]);
  for(let p=1;p<=pdf.pages;p++) expect(lines).toContain('Página '+p+' de '+pdf.pages);
  fs.writeFileSync(testInfo.outputPath('Reporte_ASSUR_M1_M10.pdf'),Buffer.from(pdf.bytes));
  await page.emulateMedia({media:'print'});
  await page.evaluate(()=>{
    window.addEventListener('beforeprint',()=>{
      window.__printedCharts=['chart-vel','chart-caudal'].map(id=>{
        const c=document.getElementById(id),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
        let painted=0;
        for(let i=3;i<pixels.length;i+=4) if(pixels[i]>0) painted++;
        return {id,painted,width:c.width,height:c.height};
      });
    });
  });
  await page.pdf({path:testInfo.outputPath('Impresion_ASSUR_M1_M10.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});
  const charts=await page.evaluate(()=>window.__printedCharts);
  expect(charts).toHaveLength(2);
  for(const chart of charts) expect(chart,JSON.stringify(chart)).toMatchObject({painted:expect.any(Number)});
  for(const chart of charts) expect(chart.painted,JSON.stringify(chart)).toBeGreaterThan(1000);
});

test('Sin cálculos: cobertura explícita y ninguna sección ficticia en PDF',async({page})=>{
  const pdf=await exportPDF(page);
  expect(pdfLines(pdf).filter(t=>/^M\d+\.\s/.test(t))).toHaveLength(0);
  expect(await page.locator('#rep-modulos tr').filter({hasText:'Sin calcular'}).count()).toBe(10);
});

test('Motor PDF ausente: avisa y no registra datos ni genera archivo',async({page})=>{
  await page.evaluate(()=>{window.jspdf=undefined;});
  await page.locator('.tab-btn[onclick="showTab(\'reporte\')"]').click();
  await page.getByRole('button',{name:'📄 Descargar PDF',exact:true}).click();
  for(const [id,value] of [['nombre','QA'],['tel','000'],['correo','qa@example.invalid']])
    await page.locator('#pdf-'+id).fill(value);
  await page.getByRole('button',{name:'📥 Generar PDF',exact:true}).click();
  await expect(page.locator('#pdf-error')).toContainText('No se pudo cargar el motor PDF');
  expect(await page.evaluate(()=>window.__reportPDF)).toBeUndefined();
});

test('Ctrl+P desde otro módulo actualiza cobertura sin alterar navegación',async({page})=>{
  await calculate(page,modules[6]);
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
  await expect(page.locator('#sec-sanitario')).toHaveClass(/active/);
  await expect(page.locator('#rep-modulos')).toContainText('M7');
  await page.emulateMedia({media:'print'});
  await expect(page.locator('#sec-reporte')).toBeVisible();
  await expect(page.locator('#sec-sanitario')).toBeHidden();
  await page.emulateMedia({media:'screen'});
  await expect(page.locator('#sec-sanitario')).toBeVisible();
});

test('Botón Imprimir prepara el reporte y llama una vez a la impresión nativa',async({page})=>{
  await calculate(page,modules[0]);
  await page.locator('.tab-btn[onclick="showTab(\'reporte\')"]').click();
  await page.evaluate(()=>{
    window.__printCalls=0;
    window.print=()=>{window.__printCalls++;window.dispatchEvent(new Event('beforeprint'));};
  });
  await page.getByRole('button',{name:'Imprimir / Guardar PDF',exact:true}).click();
  expect(await page.evaluate(()=>window.__printCalls)).toBe(1);
  expect(await page.locator('#rep-modulos tr').filter({hasText:'Calculado · incluido'}).count()).toBe(1);
});
