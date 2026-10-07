package linthost

import "testing"

// TestConsistentReturnAcceptsFunctionsThatReturnOnEveryPathThroughSwitchAndTry
// verifies that a function returning a value on every path through a switch or
// try is consistent, while one with a path that falls off its end is not.
//
// consistent-return reports a function that returns a value on one path and
// leaves the end of its body reachable. A switch with a default whose clauses
// all return, and a try whose blocks all return, leave no such path.
//
//  1. Run the rule over functions that return a value in every clause of a switch
//     with a default and in both blocks of a try and catch.
//  2. Assert neither reports.
//  3. Run the rule over a switch with no default and over a catch that falls
//     through, and assert each reports once.
//
// @evidence contracts/testing.md#behavioral-verification consistent-return must accept functions that return a value on every path through switch and try and must report the same shapes once a path can reach the end of the body.
// @evidence contracts/testing.md#independent-expectations ECMAScript control flow decides the expectations: a default clause and returning blocks leave no path to the end of the body, while a missing default or a catch that completes normally does.
// @evidence contracts/testing.md#distinguishing-cases Each accepted function has a negative twin that removes the default clause or makes the catch fall through.
// @evidence contracts/testing.md#execution-ownership TestConsistentReturnAcceptsFunctionsThatReturnOnEveryPathThroughSwitchAndTry parses virtual sources and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestConsistentReturnAcceptsFunctionsThatReturnOnEveryPathThroughSwitchAndTry(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "consistent-return",
    "function pick(k: number): number {\n  switch (k) {\n    case 1:\n      return 1;\n    default:\n      return 2;\n  }\n}\nJSON.stringify(pick);\n",
  )
  assertRuleSkipsSource(
    t,
    "consistent-return",
    "function guard(): number {\n  try {\n    return 1;\n  } catch {\n    return 2;\n  }\n}\nJSON.stringify(guard);\n",
  )
  for _, source := range []string{
    "function pick(k: number): number | undefined {\n  switch (k) {\n    case 1:\n      return 1;\n    case 2:\n      return 2;\n  }\n}\nJSON.stringify(pick);\n",
    "function guard(): number | undefined {\n  try {\n    return 1;\n  } catch {\n    JSON.stringify(0);\n  }\n}\nJSON.stringify(guard);\n",
  } {
    _, _, findings := runRuleFindingsSnapshot(t, "consistent-return", source, nil)
    if len(findings) != 1 {
      t.Fatalf("consistent-return on %q: want exactly one finding, got %d", source, len(findings))
    }
  }
}
