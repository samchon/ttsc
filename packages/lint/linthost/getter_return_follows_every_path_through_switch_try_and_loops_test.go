package linthost

import "testing"

// TestGetterReturnFollowsEveryPathThroughSwitchTryAndLoops verifies that
// getter-return judges whole control flow, not only a getter's last statement.
//
// A getter whose every path returns through a `switch` with a `default`, a
// `try`/`catch`, a `finally` or a never-ending loop cannot produce `undefined`,
// while a path that falls off the end can.
//
//  1. Run the rule over getters that return on every path through a switch with
//     default, try and catch, a returning finally, `while (true)` and `for (;;)`.
//  2. Assert none reports.
//  3. Run the rule over getters whose switch lacks a default, whose switch breaks
//     out, whose catch falls through, whose loop breaks and whose return is bare,
//     and assert each reports exactly once.
//
// @evidence contracts/testing.md#behavioral-verification getter-return must accept getters that return a value on every path through switch, try, finally and infinite loops and must report each getter that has a path leaving the body.
// @evidence contracts/testing.md#independent-expectations ECMAScript control flow decides the expectations: a switch with a default whose last clause returns, a try and catch that both return, a returning finally and a constant-true loop without break never complete normally, and the negative sources each have a reachable path to the end of the body.
// @evidence contracts/testing.md#distinguishing-cases Each accepted shape has a negative twin that removes the one property that made it exhaustive: the default clause, the escaping break, the returning catch, the loop break and the return value.
// @evidence contracts/testing.md#execution-ownership TestGetterReturnFollowsEveryPathThroughSwitchTryAndLoops parses virtual sources and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestGetterReturnFollowsEveryPathThroughSwitchTryAndLoops(t *testing.T) {
  clean := []string{
    "class A { get v(): number { switch (this.k) { case 1: return 1; default: return 2; } } k = 0; }\nJSON.stringify(A);\n",
    "class A { get v(): number { try { return 1; } catch { return 2; } } }\nJSON.stringify(A);\n",
    "class A { get v(): number { try { work(); } finally { return 3; } } }\nfunction work(): void {}\nJSON.stringify(A);\n",
    "class A { get v(): number { while (true) { if (Math.random() > 1) { return 1; } } } }\nJSON.stringify(A);\n",
    "class A { get v(): number { for (;;) { return 1; } } }\nJSON.stringify(A);\n",
  }
  for _, source := range clean {
    assertRuleSkipsSource(t, "getter-return", source)
  }
  reported := []string{
    "class A { k = 0; get v(): number { switch (this.k) { case 1: return 1; case 2: return 2; } } }\nJSON.stringify(A);\n",
    "class A { k = 0; get v(): number { switch (this.k) { case 1: break; default: return 2; } } }\nJSON.stringify(A);\n",
    "class A { get v(): number { try { return 1; } catch { work(); } } }\nfunction work(): void {}\nJSON.stringify(A);\n",
    "class A { get v(): number { while (true) { break; } } }\nJSON.stringify(A);\n",
    "class A { get v(): number | undefined { return; } }\nJSON.stringify(A);\n",
  }
  for _, source := range reported {
    _, _, findings := runRuleFindingsSnapshot(t, "getter-return", source, nil)
    if len(findings) != 1 {
      t.Fatalf("getter-return on %q: want exactly one finding, got %d", source, len(findings))
    }
  }
}
