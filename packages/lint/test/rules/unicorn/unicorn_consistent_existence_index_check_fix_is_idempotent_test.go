package linthost

import "testing"

// TestUnicornConsistentExistenceIndexCheckFixIsIdempotent verifies the fixed
// source reaches a stable fixed point: re-linting it reports nothing.
//
// The rule rewrites one comparison into another comparison on the very same
// binding, so a wrong output operator or a stale literal would make the rule
// re-report its own emission and loop `ttsc fix`. Feeding each rewritten source
// back through the rule and requiring zero findings proves `=== -1` / `!== -1`
// are terminal for all three magnitude arms.
//
//  1. Fix `< 0`, `>= 0`, and `> -1` on a const-bound index.
//  2. Re-lint each rewritten source.
//  3. Assert no further diagnostics and no further edits.
//
// @evidence contracts/testing.md#behavioral-verification runFixSnapshot must equal independently authored sentinel source and apply a fix; re-linting must produce no findings, detecting both wrong output and failure to converge.
// @evidence contracts/testing.md#independent-expectations Index methods return -1 for absence; the documented magnitude-to-sentinel policy determines literal === -1 or !== -1 outputs before the fixer runs.
// @evidence contracts/testing.md#distinguishing-cases Less-than-zero, at-least-zero and above-minus-one inputs all change once and their exact independently authored canonical results remain accepted.
// @evidence contracts/testing.md#execution-ownership TestUnicornConsistentExistenceIndexCheckFixIsIdempotent owns this authored source matrix as one discoverable Go unit entry. The owning checker-backed engine and disk-backed fix applier execute in the shared Go process; failed source comparisons retain input and expected output identity. No installed consumer, native build or child product host runs.
func TestUnicornConsistentExistenceIndexCheckFixIsIdempotent(t *testing.T) {
  const ruleName = "unicorn/consistent-existence-index-check"
  expected := []string{
    "declare const array: number[];\nconst index = array.indexOf(1);\nvoid (index === -1);\n",
    "declare const array: number[];\nconst index = array.indexOf(1);\nvoid (index !== -1);\n",
    "declare const array: number[];\nconst index = array.indexOf(1);\nvoid (index !== -1);\n",
  }
  for index, source := range []string{
    "declare const array: number[];\nconst index = array.indexOf(1);\nvoid (index < 0);\n",
    "declare const array: number[];\nconst index = array.indexOf(1);\nvoid (index >= 0);\n",
    "declare const array: number[];\nconst index = array.indexOf(1);\nvoid (index > -1);\n",
  } {
    fixed, applied := runFixSnapshot(t, ruleName, source)
    if applied == 0 {
      t.Fatalf("expected a fix for %q", source)
    }
    if fixed != expected[index] {
      t.Fatalf("fixed source mismatch for %q:\nwant %q\ngot %q", source, expected[index], fixed)
    }
    _, _, findings := runRuleFindingsSnapshot(t, ruleName, fixed, nil)
    if len(findings) != 0 {
      t.Fatalf("fixed source %q still reports %d findings: %+v", fixed, len(findings), findings)
    }
  }
}
