const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const sourcePath=process.env.ASSUR_QA_HTML
  ? path.resolve(process.env.ASSUR_QA_HTML)
  : path.resolve(__dirname,'../../index.html');
const html=fs.readFileSync(sourcePath,'utf8')
  .replace(/<script\b[^>]*\bsrc=[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace(/var ASSUR_M9_LOG_URL = '[^']*';/,"var ASSUR_M9_LOG_URL = '';");
const target='http://assur-lrfd.test/';

test.beforeEach(async({page})=>{
  const errors=[],posts=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
    const request=route.request();
    if(request.method()==='POST') posts.push(request.url());
    if(request.url()===target && request.method()==='GET')
      return route.fulfill({contentType:'text/html',body:html});
    return route.abort();
  });
  await page.addInitScript(()=>{
    window.Chart=class{destroy(){} update(){}};
  });
  await page.goto(target,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:/9 · Diseño Concreto/}).click();
  // Instrumentación de conteo; las interacciones se realizan mediante controles reales.
  await page.evaluate(()=>{
    const calculate=window.calcM9;
    window.__lrfdCalculations=0;
    window.calcM9=function(...args){
      window.__lrfdCalculations++;
      return calculate.apply(this,args);
    };
  });
  page.__lrfdErrors=errors;
  page.__lrfdPosts=posts;
});

test.afterEach(async({page})=>{
  expect(page.__lrfdErrors).toEqual([]);
  expect(page.__lrfdPosts).toEqual([]);
});

async function checkState(page,checked,calls){
  const checkbox=page.getByRole('checkbox',{name:'Activar modo LRFD',exact:true});
  if(checked) await expect(checkbox).toBeChecked();
  else await expect(checkbox).not.toBeChecked();
  expect(await page.evaluate(()=>window.__lrfdCalculations)).toBe(calls);
  expect(await page.evaluate(()=>STATE.m9.useLRFD)).toBe(checked);
}

test('Clic directo activa y desactiva una sola vez por interacción',async({page})=>{
  const checkbox=page.getByRole('checkbox',{name:'Activar modo LRFD',exact:true});
  await checkState(page,false,0);
  await checkbox.click();
  await checkState(page,true,1);
  await checkbox.click();
  await checkState(page,false,2);
});

test('Espacio activa y desactiva el checkbox con teclado nativo',async({page})=>{
  const checkbox=page.getByRole('checkbox',{name:'Activar modo LRFD',exact:true});
  await checkbox.focus();
  await checkbox.press('Space');
  await checkState(page,true,1);
  await checkbox.press('Space');
  await checkState(page,false,2);
});

test('Clic en cabecera conserva el control reversible',async({page})=>{
  const header=page.locator('#m9-lrfd-toggle').locator('..');
  await header.click();
  await checkState(page,true,1);
  await header.click();
  await checkState(page,false,2);
});

test('Cabecera, teclado y clic directo no pierden sincronización',async({page})=>{
  const checkbox=page.getByRole('checkbox',{name:'Activar modo LRFD',exact:true});
  await page.locator('#m9-lrfd-toggle').locator('..').click();
  await checkState(page,true,1);
  await checkbox.focus();
  await checkbox.press('Space');
  await checkState(page,false,2);
  await checkbox.click();
  await checkState(page,true,3);
  await page.locator('#m9-lrfd-toggle').locator('..').click();
  await checkState(page,false,4);
});
