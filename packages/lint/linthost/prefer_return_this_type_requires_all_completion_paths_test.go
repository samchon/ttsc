package linthost

import "testing"

// TestPreferReturnThisTypeRequiresAllCompletionPaths verifies truthful fluent return findings.
//
// Bare returns and reachable fallthrough produce undefined, while throws do
// not return another value. Nested functions have their own return boundary.
//
// 1. Load each method into a real Program and Checker.
// 2. Assert exact findings for complete this returns and partial returns.
//
// @evidence contracts/testing.md#behavioral-verification The real typed Engine distinguishes every completion returning this from bare returns, fallthrough and another returned instance.
// @evidence contracts/testing.md#independent-expectations JavaScript bare returns and fallthrough yield undefined, so replacing A|undefined with this cannot preserve their declared return contract.
// @evidence contracts/testing.md#distinguishing-cases Complete branches, throw branches, bare/implicit returns, finally overrides, nested functions, existing this and absent annotations have authored count oracles.
// @evidence contracts/testing.md#execution-ownership TestPreferReturnThisTypeRequiresAllCompletionPaths runs named subcases through runRuleFindingsSnapshot and its real Program/Checker in the enrolled Go rules unit batch; fixtures are released by testing without launching a compiler process.
func TestPreferReturnThisTypeRequiresAllCompletionPaths(t *testing.T) {
  cases := []struct {
    name, method string
    want         int
  }{
    {"always", "m(): A { return this; }", 1},
    {"branches", "m(flag: boolean): A { if (flag) return this; else return this; }", 1},
    {"throw", "m(flag: boolean): A { if (flag) return this; throw new Error(); }", 1},
    {"bare", "m(flag: boolean): A | undefined { if (flag) return this; return; }", 0},
    {"fallthrough", "m(flag: boolean): A | undefined { if (flag) return this; }", 0},
    {"other", "m(flag: boolean): A { if (flag) return this; return new A(); }", 0},
    {"finally-bare", "m(): A | undefined { try { return this; } finally { return; } }", 0},
    {"nested-return", "m(): A { const f = () => undefined; f(); return this; }", 1},
    {"nested-only", "m(): A | undefined { const f = () => this; f(); }", 0},
    {"this-annotation", "m(): this { return this; }", 0},
    {"unannotated", "m() { return this; }", 0},
    {"parenthesized", "m(): A { return (this); }", 1},
  }
  for _, c := range cases {
    t.Run(c.name, func(t *testing.T) {
      _, _, findings := runRuleFindingsSnapshot(t, "typescript/prefer-return-this-type", "class A { "+c.method+" }", nil)
      if len(findings) != c.want {
        t.Errorf("findings=%d, want %d: %+v", len(findings), c.want, findings)
      }
    })
  }
}
