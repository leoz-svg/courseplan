import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalogGraph,courseChain,graphScope,layoutCourseGraph} from '../lib/course-graph.ts';
const all=[...JSON.parse(await readFile(new URL('../app/data/catalog/subjects.json',import.meta.url),'utf8')),...JSON.parse(await readFile(new URL('../app/data/catalog/program-subjects.json',import.meta.url),'utf8'))];
const course=(code,refs=[])=>({code,title:code,rules:[{kind:'academic',expression:{op:'all',children:refs.map(r=>({op:'subject',code:r,timing:'prior'}))}}]});
test('all catalog courses have finite, unique positions across all three programs',()=>{
 for(const program of ['computing','business','design']){
  const catalog=all.filter(c=>c.dataset_id===`uts-2024-${program}-snapshot`),scope=graphScope(catalog,catalog.map(c=>c.code),catalog[0].code,false),layout=layoutCourseGraph(catalog,scope);
  assert.equal(Object.keys(layout.positions).length,catalog.length);assert.equal(new Set(Object.values(layout.positions).map(p=>`${p.x},${p.y}`)).size,catalog.length);
  for(const p of Object.values(layout.positions)){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(p.x>=0&&p.x+236<=layout.width&&p.y+106<=layout.height);}
  assert.deepEqual(layoutCourseGraph([...catalog].reverse(),scope).positions,layout.positions);
 }
});
test('direction adds recursive prerequisite alternatives and a selected course outside the direction',()=>{
 const c=[course('10001'),course('10002',['10001']),course('10003',['10002']),course('10004')];assert.deepEqual([...graphScope(c,['10003'],'10004',false)].sort(),['10001','10002','10003','10004']);
});
test('focus includes upstream and downstream chain but excludes unrelated courses',()=>{
 const c=[course('10001'),course('10002',['10001']),course('10003',['10002']),course('10004')];assert.deepEqual([...graphScope(c,c.map(c=>c.code),'10002',true)].sort(),['10001','10002','10003']);
});
test('mutual references do not recurse forever and share a layer before dependent courses',()=>{
 const c=[course('10001',['10002']),course('10002',['10001']),course('10003',['10002'])],l=layoutCourseGraph(c,new Set(c.map(c=>c.code)));assert.equal(l.sharedGroups,1);assert.equal(l.positions['10001'].level,l.positions['10002'].level);assert.ok(l.positions['10003'].level>l.positions['10002'].level);assert.deepEqual([...courseChain('10001',catalogGraph(c).edges).ancestors],['10002']);
});
test('external references are reported without creating fake catalog nodes or dropping known isolated courses',()=>{
 const c=[course('10001',['99999']),course('10002')],l=layoutCourseGraph(c,new Set(c.map(c=>c.code)));assert.equal(l.edges.length,0);assert.deepEqual(l.missing,[{from:'99999',to:'10001'}]);assert.equal(Object.keys(l.positions).length,2);assert.ok(!l.positions['99999']);
});
test('AND/OR edges remain references and academic links exclude admission or exclusion text',()=>{
 const c=[course('10001'),course('10002'),{...course('10003'),rules:[{kind:'academic',expression:{op:'any',children:[{op:'subject',code:'10001',timing:'prior'},{op:'subject',code:'10002',timing:'concurrent'}]}},{kind:'exclusion',expression:{op:'subject',code:'10001',timing:'prior'}}]}];
 assert.deepEqual(catalogGraph(c).edges,[{from:'10001',to:'10003',timing:'prior'},{from:'10002',to:'10003',timing:'concurrent'}]);
});
