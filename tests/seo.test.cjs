const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const main=execFileSync('git',['show','origin/main:index.html'],{cwd:root,encoding:'utf8',maxBuffer:20e6});
test('SEO: scripts ejecutables y cuerpo idénticos a main',()=>{
  const scripts=x=>[...x.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(m=>!m[1].includes('application/ld+json')).map(m=>m[0]);
  assert.deepEqual(scripts(html),scripts(main));
  assert.ok(html.split('<body>')[1].trimEnd()===main.split('<body>')[1].trimEnd(),
    'El cuerpo no debe cambiar salvo el salto de línea final');
});
test('SEO: canonical, description, OG y JSON-LD coherentes',()=>{
  assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
  assert.match(html,/<html lang="es-MX">/);
  assert.match(html,/<link rel="canonical" href="https:\/\/calculadora.assur.mx\/">/);
  assert.match(html,/<meta name="description" content="[^"]+">/);
  assert.match(html,/<meta property="og:url" content="https:\/\/calculadora.assur.mx\/">/);
  const schemas=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(schemas.length,1);
  const s=JSON.parse(schemas[0][1]);
  assert.equal(s['@type'],'WebApplication');
  assert.equal(s.url,'https://calculadora.assur.mx/');
  assert.equal(s.isAccessibleForFree,true);
  assert.equal(s.inLanguage,'es-MX');
  assert.equal(s.aggregateRating,undefined);
});
