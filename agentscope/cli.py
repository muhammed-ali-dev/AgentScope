from __future__ import annotations

import argparse
import json

from .agent import run_demo
from .eval import diff_runs, run_benchmark, run_regression_suite


def main() -> None:
    parser = argparse.ArgumentParser(prog="agentscope")
    sub = parser.add_subparsers(dest="command", required=True)
    demo = sub.add_parser("demo")
    demo.add_argument("--scenario", default="D2")
    demo.add_argument("--condition", default="agentscope")
    sub.add_parser("eval")
    replay = sub.add_parser("replay")
    replay.add_argument("--scenario", default="D2")
    replay.add_argument("--condition", default="agentscope")
    diff = sub.add_parser("diff")
    diff.add_argument("--scenario", default="C1")
    diff.add_argument("--before", default="baseline")
    diff.add_argument("--after", default="candidate")
    sub.add_parser("report")
    args = parser.parse_args()
    if args.command in {"demo", "replay"}:
        print(json.dumps(run_demo(args.scenario, args.condition), indent=2))
    elif args.command == "diff":
        print(json.dumps(diff_runs(run_demo(args.scenario, args.before), run_demo(args.scenario, args.after)), indent=2))
    else:
        results = run_benchmark()
        passed = sum(result["passed"] for result in results)
        mutations = run_regression_suite()
        print(json.dumps({"cases": len(results), "passed": passed, "failed": len(results) - passed, "seeded_regressions": {"cases": len(mutations), "detected": sum(item["mutation_detected"] for item in mutations)}, "results": results}, indent=2))


if __name__ == "__main__":
    main()
