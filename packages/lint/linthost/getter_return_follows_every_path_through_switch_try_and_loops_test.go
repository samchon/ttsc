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
// @evidence contracts/testing.md#behavioral-verification getter-return must accept the authored returning switch/try/finally and non-completing loop getters. It must report each authored fallthrough/break/catch case and the separate bare return that implicitly returns undefined.
// @evidence contracts/testing.md#independent-expectations The authored control-flow oracles distinguish value returns and non-completing loops from body fallthrough. Missing switch default, escaping switch/loop break and falling-through catch permit body completion; the separate bare return yields undefined without reaching the body end.
// @evidence contracts/testing.md#distinguishing-cases The switch controls remove its default or add an escaping break, the catch control falls through, and the loop control breaks. Returning finally and for(;;) are additional accepted shapes; the bare-return source independently covers implicit undefined rather than a one-to-one twin for every accepted shape.
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
