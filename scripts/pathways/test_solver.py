import unittest,json,pathlib,copy
from solve import solve,prepare,audit
ROOT=pathlib.Path(__file__).resolve().parents[2]
class PathwayTests(unittest.TestCase):
 def setUp(self):self.job=json.loads((ROOT/'tests/fixtures/design-pathway-job.json').read_text())
 def test_degree_targets_modules_and_diverse_independently_audited_schedules(self):
  result=solve(self.job);self.assertEqual(result['status'],'OK');self.assertEqual(len(result['proposals']),3)
  signatures=set()
  for p in result['proposals']:
   self.assertEqual(p['finalCredits'],144);self.assertTrue(p['auditPassed']);self.assertLessEqual(p['peakCredits'],24)
   by={c['code']:c for c in self.job['catalog']};self.assertEqual([sum(by[c]['credit_points'] for c in p['allocations'][g]) for g in ['core','studies','electives','td']],[108,18,12,6])
   choices=set(p['allocations']['studies']+p['allocations']['electives']+p['allocations']['td']);signatures.add(tuple(sorted(choices)))
  self.assertEqual(len(signatures),3)
 def test_waivers_not_scheduled_or_double_counted(self):
  self.job['priorCredits']=12;self.job['options']['waivedCodes']=['85502','85503'];self.job['plan']['completed']=['87631']
  result=solve(self.job);self.assertEqual(result['status'],'OK')
  for p in result['proposals']:
   self.assertEqual(p['achievedCredits'],24);self.assertEqual(p['newCredits'],120);scheduled={c for t in p['terms'] for c in t['courseCodes']};self.assertFalse(scheduled&{'85502','85503','87631'})
 def test_unallocated_prior_credits_block_degree_claim(self):
  self.job['priorCredits']=12;self.assertEqual(solve(self.job)['status'],'INPUT_CONFLICT')
 def test_mandatory_exclusion_is_reported(self):
  self.job['options']['excludedCodes']=['87631'];self.assertEqual(solve(self.job)['status'],'INPUT_CONFLICT')
 def test_strict_offerings_reports_missing_required_data(self):
  self.job['options']['strictOfferings']=True;result=solve(self.job);self.assertEqual(result['status'],'INSUFFICIENT_DATA');self.assertEqual(result['proposals'],[])
 def test_credit_granularity(self):
  self.job['options'].update(mode='stage',targetCredits=25);self.job['requirements']=None;self.assertEqual(solve(self.job)['status'],'INPUT_CONFLICT')
 def test_insufficient_catalog_does_not_fabricate_courses(self):
  self.job['catalog']=self.job['catalog'][:2];self.job['options'].update(mode='stage');self.job['requirements']=None;result=solve(self.job);self.assertEqual(result['status'],'INSUFFICIENT_DATA');self.assertFalse(result['proposals'])
 def test_ambiguous_waiver_requires_explicit_group(self):
  self.job['priorCredits']=6;self.job['options']['waivedCodes']=['85001'];self.assertEqual(solve(self.job)['status'],'INPUT_CONFLICT');self.job['options']['waiverGroups']={'85001':'studies'};self.assertEqual(solve(self.job)['status'],'OK')
 def tiny(self,concurrent=False):
  job=copy.deepcopy(self.job);base={'credit_points':6,'dataset_id':'tiny','offerings':[{'session':'Autumn'},{'session':'Spring'}]}
  job['catalog']=[{**base,'code':'10001','title':'Foundation','rules':[{'kind':'academic','expression':{'op':'all','children':[]},'raw_text':''}]},{**base,'code':'10002','title':'Advanced','rules':[{'kind':'academic','expression':{'op':'subject','code':'10001','timing':'concurrent' if concurrent else 'prior'},'raw_text':''}]}];job['requirements']=None;job['options'].update(mode='stage',targetCredits=12,maxPerTerm=12);return job
 def test_prior_and_concurrent_have_different_scheduling(self):
  for concurrent,semesters in [(False,2),(True,1)]:
   result=solve(self.tiny(concurrent));self.assertEqual(result['status'],'OK');self.assertEqual(result['proposals'][0]['semesterCount'],semesters)
 def test_locked_overload_not_silently_moved(self):
  job=self.tiny(True);job['options']['maxPerTerm']=6;job['plan']['terms'][0]['courseCodes']=['10001','10002'];self.assertEqual(solve(job)['status'],'NO_FEASIBLE_PLAN');job['options']['keepExisting']=False;self.assertEqual(solve(job)['status'],'OK')
 def test_anti_requisite_combination_rejected(self):
  job=self.tiny(True);job['catalog'][0]['rules'].append({'kind':'exclusion','expression':{'op':'manual','text':'10002'},'raw_text':'10002'});self.assertEqual(solve(job)['status'],'NO_FEASIBLE_PLAN')
 def test_independent_audit_rejects_tampered_prerequisite_order(self):
  job=self.tiny(False);ctx=prepare(job);schedule=copy.deepcopy(ctx['terms']);schedule[0]['courseCodes']=['10002'];schedule[1]['courseCodes']=['10001']
  with self.assertRaises(AssertionError):audit(ctx,schedule,{})
 def test_computing_foundations_and_equivalent_programming_credit(self):
  self.job['catalog']=json.loads((ROOT/'app/data/catalog/subjects.json').read_text(encoding='utf-8'));self.job['requirements']=None;self.job['availabilityEvidence']={};self.job['semesterHints']={};self.job['options'].update(mode='stage',targetCredits=24)
  result=solve(self.job);self.assertEqual(result['status'],'OK')
  for p in result['proposals']:
   codes={c for t in p['terms'] for c in t['courseCodes']};self.assertFalse({'41039','48023'}<=codes);self.assertEqual(p['finalCredits'],24);self.assertTrue(p['auditPassed'])
 def test_expanded_programs_can_reach_144_without_fabrication(self):
  rows=json.loads((ROOT/'app/data/catalog/subjects.json').read_text(encoding='utf-8'))+json.loads((ROOT/'app/data/catalog/program-subjects.json').read_text(encoding='utf-8'));evidence=json.loads((ROOT/'app/data/catalog/expanded-program-evidence.json').read_text(encoding='utf-8'))
  for program in ['computing','business']:
   job=copy.deepcopy(self.job);job['catalog']=[c for c in rows if c['dataset_id']==f'uts-2024-{program}-snapshot'];job['requirements']=None;job['options'].update(mode='stage',targetCredits=144);job['semesterHints']={};job['availabilityEvidence']={e['code']:e['availability'] for e in evidence}
   result=solve(job);self.assertEqual(result['status'],'OK',program);self.assertEqual(len(result['proposals']),3)
   for p in result['proposals']:
    self.assertEqual(p['finalCredits'],144);self.assertTrue(p['auditPassed']);self.assertLessEqual(p['peakCredits'],24);self.assertLessEqual(p['finish']['year'],2030)
    scheduled=[code for t in p['terms'] for code in t['courseCodes']];self.assertEqual(len(scheduled),len(set(scheduled)))
 def test_program_specific_and_module_specific_credit_rules_are_distinguished(self):
  rows=json.loads((ROOT/'app/data/catalog/subjects.json').read_text(encoding='utf-8'))+json.loads((ROOT/'app/data/catalog/program-subjects.json').read_text(encoding='utf-8'));by={c['code']:c for c in rows}
  self.assertTrue(prepare({**self.job,'requirements':None}) is not None)
  from solve import evaluate
  self.assertFalse(evaluate(by['31272']['rules'][0]['expression'],{'31269','31265'},set(),66));self.assertTrue(evaluate(by['31272']['rules'][0]['expression'],{'31269','31265'},set(),72))
  # A Management-major credit condition cannot be satisfied by generic accumulated credit.
  self.assertFalse(evaluate(by['21504']['rules'][0]['expression'],set(by),set(),600))
 def test_already_met_stage_goal(self):
  job=self.tiny();job['plan']['completed']=['10001','10002'];self.assertEqual(solve(job)['status'],'ALREADY_MET')
if __name__=='__main__':unittest.main(verbosity=2)

