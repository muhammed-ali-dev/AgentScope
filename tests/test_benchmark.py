import unittest

from agentscope.agent import run_demo
from agentscope.benchmark import CASES
from agentscope.eval import evaluate


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


if __name__ == "__main__":
    unittest.main()
