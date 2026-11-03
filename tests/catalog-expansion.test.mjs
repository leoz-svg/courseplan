import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mergeCatalogSnapshot} from '../lib/catalog-merge.ts';
const computing=JSON.parse(await readFile(new URL('../app/data/catalog/subjects.json',import.meta.url),'utf8'));
const additional=JSON.parse(await readFile(new URL('../app/data/catalog/program-subjects.json',import.meta.url),'utf8'));
const pools=JSON.parse(await readFile(new URL('../app/data/catalog/expanded-program-pools.json',import.meta.url),'utf8'));
test('old cloud subset cannot erase expanded courses or reviewed prerequisites',()=>{
 const remote=computing.slice(0,16).map(c=>({...c,rules:[],title:'Old title'}));const merged=mergeCatalogSnapshot(computing,remote);
 assert.equal(merged.length,65);assert.equal(new Set(merged.map(c=>c.code)).size,65);assert.ok(merged.every(c=>c.title!=='Old title'&&c.rules.some(r=>r.kind==='academic')));assert.ok(merged.some(c=>c.code==='41092'));
});
test('each expanded program contains its official package courses and stays isolated',()=>{
 for(const program of ['computing','business']){
  const catalog=program==='computing'?computing:additional.filter(c=>c.dataset_id==='uts-2024-business-snapshot');const codes=new Set(catalog.map(c=>c.code));
  assert.equal(codes.size,catalog.length);assert.ok(catalog.reduce((s,c)=>s+c.credit_points,0)>=144);
  for(const id of pools.programs[program])for(const code of pools.packages.find(p=>p.id===id).codes)assert.ok(codes.has(code),`${program} missing ${code}`);
 }
 assert.ok(!computing.some(c=>c.code==='25556'));assert.ok(!additional.filter(c=>c.dataset_id==='uts-2024-business-snapshot').some(c=>c.code==='41025'));
});
