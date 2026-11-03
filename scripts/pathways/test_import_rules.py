import unittest,json,pathlib,importlib.util
from solve import evaluate
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('import_catalog',ROOT/'scripts/import-expanded-programs.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
E={r['code']:r for r in json.loads((ROOT/'app/data/catalog/expanded-program-evidence.json').read_text(encoding='utf-8'))}
class ImportRulesTests(unittest.TestCase):
 def node(self,code,program='computing'):return module.expression(E[code]['raw_requisites'],code,program)
 def test_source_and_or_grouping_is_preserved(self):
  n=self.node('31005');self.assertTrue(evaluate(n,{'31250','48024'},set(),0));self.assertTrue(evaluate(n,{'31250','41091'},set(),0));self.assertFalse(evaluate(n,{'48024'},set(),0))
 def test_corequisite_requires_explicit_c_marker(self):
  self.assertTrue(evaluate(self.node('31263'),set(),{'48024'},0));self.assertFalse(evaluate(self.node('31251'),set(),{'48024'},0))
 def test_unreviewed_malformed_rule_remains_manual(self):
  self.assertEqual(module.expression('(11111 AND )','99999','computing')['op'],'manual')
 def test_major_scoped_credits_not_replaced_by_total_credits(self):
  self.assertEqual(self.node('21504','business')['op'],'manual');self.assertFalse(evaluate(self.node('21504','business'),set(E),set(),600))
 def test_changed_source_invalidates_reviewed_override(self):
  self.assertEqual(module.expression(E['31269']['raw_requisites']+' AND permission required','31269','computing')['op'],'manual')
 def test_reviewed_program_credit_rule_keeps_threshold(self):
  n=self.node('31272');self.assertFalse(evaluate(n,{'31269','31265'},set(),66));self.assertTrue(evaluate(n,{'31269','31265'},set(),72))
if __name__=='__main__':unittest.main(verbosity=2)
