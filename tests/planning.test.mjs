import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {emptyPlan,placeCourse,courseEligibility,validatePlan,restorePlan} from '../lib/planning.ts';
const catalog=JSON.parse(await readFile(new URL('../app/data/catalog/subjects.json',import.meta.url),'utf8'));const course=code=>catalog.find(c=>c.code===code);
test('OR prerequisite accepts Programming 1; moving it later revalidates downstream',()=>{
 let p=placeCourse(emptyPlan(),'41039','t1');p=placeCourse(p,'48024','t2');assert.equal(courseEligibility(course('48024'),p,'t2',catalog),'met');
 p=placeCourse(p,'41039','t3');assert.equal(courseEligibility(course('48024'),p,'t2',catalog),'unmet');assert.ok(validatePlan(p,catalog).some(i=>i.code==='48024'&&i.severity==='error'));assert.ok(p.terms[1].courseCodes.includes('48024'));
});
test('another OR option keeps the course valid after one prerequisite is moved',()=>{
 let p=placeCourse(emptyPlan(),'41039','t1');p=placeCourse(p,'48023','t1');p=placeCourse(p,'48024','t2');p=placeCourse(p,'41039','t3');assert.equal(courseEligibility(course('48024'),p,'t2',catalog),'met');
});
test('corequisite allows same-term, prior prerequisite does not',()=>{
 let p=placeCourse(emptyPlan(),'48024','t2');p=placeCourse(p,'31263','t2');assert.equal(courseEligibility(course('31263'),p,'t2',catalog),'met');assert.equal(courseEligibility(course('31251'),p,'t2',catalog),'unmet');
});
test('moving and completing are unique; unknown conditions remain unknown',()=>{
 let p=placeCourse(emptyPlan(),'41039','t1');p=placeCourse(p,'41039','completed');assert.equal(p.terms.flatMap(t=>t.courseCodes).length,0);assert.deepEqual(p.completed,['41039']);assert.equal(courseEligibility(course('32009'),p,'t1',catalog),'unknown');
});
test('legacy mismatched catalog and duplicate imported courses are rejected',()=>{
 assert.throws(()=>restorePlan({version:1},catalog));const p=emptyPlan();p.terms[0].courseCodes=['41039'];p.terms[1].courseCodes=['41039'];assert.throws(()=>restorePlan(p,catalog));assert.deepEqual(restorePlan(emptyPlan(),catalog),emptyPlan());
});
