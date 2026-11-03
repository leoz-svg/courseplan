import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cosine,rankVectors,vectorDocuments} from '../lib/vector-search.ts';
test('cosine handles normalization and rejects corrupted vectors',()=>{assert.equal(cosine([1,0],[2,0]),1);assert.equal(cosine([1,0],[0,1]),0);assert.throws(()=>cosine([0,0],[1,0]));assert.throws(()=>cosine([1],[1,2]));assert.throws(()=>cosine([NaN],[1]));});
test('semantic ranking excludes planned courses and abstains below threshold',()=>{const rows=[{code:'a',vector:[1,0]},{code:'b',vector:[.8,.6]},{code:'c',vector:[0,1]}];assert.deepEqual(rankVectors([1,0],rows,['a'],.7).map(r=>r.code),['b']);assert.deepEqual(rankVectors([-1,0],rows,[],.42),[]);});
test('index document ordering is stable and reflects title changes',()=>{const course={code:'b',title:'Programming',credit_points:6,faculty:null};const a=vectorDocuments([course,{...course,code:'a'}]);assert.deepEqual(a.map(d=>d.code),['a','b']);assert.notEqual(a[1].text,vectorDocuments([{...course,title:'Graphics'}])[0].text);});
