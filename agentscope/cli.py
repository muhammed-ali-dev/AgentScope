from __future__ import annotations

import argparse
import json

from .agent import run_demo
from .eval import run_benchmark


def main() -> None:
    parser = argparse.ArgumentParser(prog="agentscope")
    sub = parser.add_subparsers(dest="command", required=True)
    demo = sub.add_parser("demo")
    demo.add_argument("--scenario", default="D2")
    demo.add_argument("--condition", default="agentscope")
    sub.add_parser("eval")
    sub.add_parser("report")
    args = parser.parse_args()
    if args.command == "demo":
        print(json.dumps(run_demo(args.scenario, args.condition), indent=2))
    else:
        results = run_benchmark()
        passed = sum(result["passed"] for result in results)
        print(json.dumps({"cases": len(results), "passed": passed, "failed": len(results) - passed, "results": results}, indent=2))


if __name__ == "__main__":
    main()
