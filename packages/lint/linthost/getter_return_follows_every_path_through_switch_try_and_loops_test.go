package linthost

import "testing"

// TestGetterReturnFollowsEveryPathThroughSwitchTryAndLoops verifies that
// getter-return judges whole control flow, not only a getter's last statement.
//
// Returning switch/try/finally paths and loops that do not complete leave
// no implicit undefined result. A fallthrough path or an explicit bare
// return does permit that result; these are distinct reporting cases.
//
//  1. Run the rule over getters that return on every path through a switch with
//     default, try and catch, a returning finally, `while (true)` and `for (;;)`.
//  2. Assert none reports.
//  3. Run the rule over getters whose switch lacks a default, whose switch breaks
//     out, whose catch falls through, whose loop breaks and whose return is bare,
//     and assert each reports exactly once.
//
// @evidence contracts/testing.md#behavioral-verification The actual getter-return Engine must accept returning or non-completing paths and report exactly once for each authored undefined-producing path, including earlier switch clauses, loop bodies, sequential bare returns and finally overrides.
// @evidence contracts/testing.md#independent-expectations ECMAScript completion semantics retain a bare return through switch and loop execution, while an abrupt finally replaces the prior outcome. A value-returning finally overrides a prior bare return; unreachable returns and nested function returns do not produce the outer getter result. These authored literal outcomes are independent of the analyzer.
// @evidence contracts/testing.md#distinguishing-cases Existing missing-default/break/catch controls remain. Added while/do/for/for-of and earlier-clause bare returns contrast with endless loops, value-returning finally, unreachable bare returns, nested closures and literal-false branches; conditional finally and sequential fallthrough distinguish abrupt outcome preservation from ordinary continuation.
// @evidence contracts/testing.md#execution-ownership TestGetterReturnFollowsEveryPathThroughSwitchTryAndLoops parses virtual sources and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestGetterReturnFollowsEveryPathThroughSwitchTryAndLoops(t *testing.T) {
  clean := []string{
    "class A { get v(): number { switch (this.k) { case 1: return 1; default: return 2; } } k = 0; }\nJSON.stringify(A);\n",
    "class A { get v(): number { try { return 1; } catch { return 2; } } }\nJSON.stringify(A);\n",
    "class A { get v(): number { try { work(); } finally { return 3; } } }\nfunction work(): void {}\nJSON.stringify(A);\n",
    "class A { get v(): number { while (true) { if (Math.random() > 1) { return 1; } } } }\nJSON.stringify(A);\n",
    "class A { get v(): number { for (;;) { return 1; } } }\nJSON.stringify(A);\n",
    "class A { get v() { try { return; } finally { return 3; } } }\n",
    "class A { get v() { return 1; return; } }\n",
    "class A { get v() { function inner() { return; } return 1; } }\n",
    "class A { get v() { while (false) { return; } for (; false;) { return; } if (false) { return; } return 1; } }\n",
    "class A { get v() { for (;;) { continue; } } }\n",
    "class A { get v() { while (true) { throw new Error(); } } }\n",
    "class A { k = 0; get v() { switch (this.k) { case 1: break; return; default: return 2; } return 3; } }\n",
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
    "class A { k = 0; get v() { switch (this.k) { case 0: return; default: return 1; } } }\n",
    "class A { get v() { while (true) { return; } } }\n",
    "class A { get v() { do { return; } while (true); } }\n",
    "class A { get v() { for (;;) { return; } } }\n",
    "class A { get v() { for (const x of [1]) { return; } return 1; } }\n",
    "class A { get v() { for (const x in { a: 1 }) { return; } return 1; } }\n",
    "class A { get v() { try { return 1; } finally { return; } } }\n",
    "class A { k = 0; get v() { try { return 1; } finally { if (this.k) return; } } }\n",
    "class A { get v() { return; return 1; } }\n",
    "class A { k = 0; get v() { if (this.k) return; return 1; } }\n",
  }
  for _, source := range reported {
    _, _, findings := runRuleFindingsSnapshot(t, "getter-return", source, nil)
    if len(findings) != 1 {
      t.Fatalf("getter-return on %q: want exactly one finding, got %d", source, len(findings))
    }
  }
}
