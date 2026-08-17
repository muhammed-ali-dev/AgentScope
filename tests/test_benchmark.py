import unittest

from agentscope.agent import run_demo
from agentscope.benchmark import CASES
from agentscope.eval import diff_runs, evaluate, run_regression_suite


class BenchmarkContractTests(unittest.TestCase):
    def test_every_case_has_a_passing_candidate_fixture(self) -> None:
        for case in CASES:
            with self.subTest(case=case.case_id):
                self.assertTrue(evaluate(run_demo(case.case_id, "candidate"), case)["passed"])

    def test_cost_baseline_exposes_duplicate_calls(self) -> None:
        baseline = run_demo("C1", "baseline")
        candidate = run_demo("C1", "candidate")
        baseline_calls = sum(span["kind"] == "llm" for span in baseline["spans"])
        candidate_calls = sum(span["kind"] == "llm" for span in candidate["spans"])
        self.assertGreater(baseline_calls, candidate_calls)

    def test_timeout_has_a_traceable_error_branch(self) -> None:
        run = run_demo("D5")
        self.assertIn("account.lookup.retry", [span["name"] for span in run["spans"]])

    def test_seeded_regression_suite_detects_all_mutations(self) -> None:
        results = run_regression_suite()
        self.assertEqual(len(results), 4)
        self.assertTrue(all(result["mutation_detected"] for result in results))

    def test_diff_reports_removed_cost_calls(self) -> None:
        from agentscope.agent import run_demo
        result = diff_runs(run_demo("C1", "baseline"), run_demo("C1", "candidate"))
        self.assertLess(result["llm_call_delta"], 0)


if __name__ == "__main__":
    unittest.main()
