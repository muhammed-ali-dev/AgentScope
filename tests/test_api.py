import unittest

from agentscope.api.main import diff, evaluations, overview, replay
from agentscope.models import ReplayRequest


class ApiWorkflowTests(unittest.TestCase):
    def test_replay_returns_a_new_trace(self) -> None:
        first = replay(ReplayRequest(scenario_id="D5"))
        second = replay(ReplayRequest(scenario_id="D5"))
        self.assertEqual(first["scenario_id"], "D5")
        self.assertNotEqual(first["run_id"], second["run_id"])

    def test_diff_compares_baseline_and_candidate(self) -> None:
        payload = diff("C1", "baseline", "candidate")
        self.assertEqual(payload["before"]["condition"], "baseline")
        self.assertEqual(payload["after"]["condition"], "candidate")
        self.assertLess(payload["diff"]["llm_call_delta"], 0)

    def test_overview_and_evaluations_are_derived(self) -> None:
        summary = overview()
        gate = evaluations()["seeded_regressions"]
        self.assertEqual(summary["regressions_detected"], gate["detected"])
        self.assertGreater(summary["errors"], 0)


if __name__ == "__main__":
    unittest.main()
