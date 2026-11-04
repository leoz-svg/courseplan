import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultAgentOptions,patchAgentOptions,agentContextKey,explicitAgentPatch} from '../lib/agent-contract.ts';
const plan={version:2,id:'test',name:'test',datasetId:'computing',completed:[],terms:[{id:'t1',year:2026,season:'Autumn',courseCodes:[]}]};
const profile={programId:'computing',displayName:'Test',studentId:'private',entryYear:2026,targetCredits:144,priorCredits:0};
const catalog=[{code:'a'},{code:'b'}];
test('agent cannot invent course codes or change academic history through tool arguments',()=>{
 const base=defaultAgentOptions(plan,profile);
 assert.throws(()=>patchAgentOptions(base,{requiredCodes:['made-up']},catalog));
 assert.throws(()=>patchAgentOptions(base,{waivedCodes:['a']},catalog));
 assert.throws(()=>patchAgentOptions(base,{completed:['a']},catalog));
 assert.throws(()=>patchAgentOptions(base,{mode:'degree'},catalog));
 assert.throws(()=>patchAgentOptions(base,{targetCredits:'72'},catalog));
 assert.throws(()=>patchAgentOptions(base,{requiredCodes:['a'],excludedCodes:['a']},catalog));
 assert.throws(()=>patchAgentOptions(base,{maxPerTerm:200},catalog));
});
test('multi-turn constraint updates preserve omitted fields without modifying previous drafts',()=>{
 const base=defaultAgentOptions(plan,profile),first=patchAgentOptions(base,{interest:'游戏开发',maxPerTerm:18,requiredCodes:['a']},catalog);
 const second=patchAgentOptions(first,{maxPerTerm:24},catalog);
 assert.equal(second.interest,'游戏开发');assert.deepEqual(second.requiredCodes,['a']);assert.equal(second.targetCredits,144);assert.equal(first.maxPerTerm,18);assert.equal(base.maxPerTerm,24);
 assert.equal(patchAgentOptions(first,{...first,maxPerTerm:12},catalog).maxPerTerm,12);
});
test('plan, term and academic profile changes invalidate draft context; personal identifiers are excluded',()=>{
 const key=agentContextKey(plan,profile,'t1');
 assert.equal(key,agentContextKey(plan,{...profile,studentId:'other',displayName:'Other'},'t1'));
 assert.notEqual(key,agentContextKey({...plan,completed:['a']},profile,'t1'));
 assert.notEqual(key,agentContextKey(plan,{...profile,priorCredits:6},'t1'));
 assert.notEqual(key,agentContextKey(plan,{...profile,targetCredits:72},'t1'));
 assert.notEqual(key,agentContextKey(plan,profile,'t2'));
});
test('explicit user limits override small-model mistakes; remaining credits are added to achieved credits',()=>{
 assert.deepEqual(explicitAgentPatch('累计目标改成144 CP，每学期上限24 CP，允许调整已有安排',6),{targetCredits:144,maxPerTerm:24,keepExisting:false});
 assert.deepEqual(explicitAgentPatch('还差72 CP，每学期最多18 CP，保留已有安排',12),{targetCredits:84,maxPerTerm:18,keepExisting:true});
 assert.equal(explicitAgentPatch('不要保留已有安排',0).keepExisting,false);
 assert.deepEqual(explicitAgentPatch('我想学游戏开发',0),{});
});
