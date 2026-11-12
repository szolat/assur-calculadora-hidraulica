const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {createHash} = require('node:crypto');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const baseline=require('./fixtures/seo-release-2026-11-12.json');
const hash=value=>createHash('sha256').update(value).digest('hex');
test('SEO: referencia local fija y con huellas SHA-256 válidas',()=>{
  assert.equal(baseline.sourceBase,'65ff146d20532a032944e33adb21e2b3ec900510');
  assert.equal(baseline.revision,'release/reportes-pdf-2026-11-12');
  assert.equal(baseline.path,'index.html');
  assert.equal(baseline.algorithm,'sha256');
  assert.ok(baseline.scripts.length>0);
  for(const digest of [...baseline.scripts,baseline.body])
    assert.match(digest,/^[a-f0-9]{64}$/);
});
test('SEO: scripts y cuerpo coinciden con la integración revisada del 2026-11-12',()=>{
  const scripts=x=>[...x.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(m=>!m[1].includes('application/ld+json')).map(m=>m[0]);
  assert.deepEqual(scripts(html).map(hash),baseline.scripts);
  assert.equal(hash(html.split('<body>')[1].trimEnd()),baseline.body,
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
