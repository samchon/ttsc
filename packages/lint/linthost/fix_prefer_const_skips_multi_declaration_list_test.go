package linthost

import "testing"

// TestFixPreferConstSkipsMultiDeclarationList verifies conservative preferConst fixing.
//
// The current native rule reports each declaration in a multi-declaration
// `let` list independently. Replacing the shared keyword would affect every
// declaration in the list, so the fixer must leave that source unchanged until
// the rule can split declarations safely.
//
// 1. Parse a `let` declaration list with two never-reassigned bindings.
// 2. Run preferConst and apply any offered text edits.
// 3. Assert both declaration identifiers are reported but no automatic edit is applied.
//
// @evidence contracts/testing.md#behavioral-verification prefer-const reports the stable left/right list without rewriting its shared let keyword.
// @evidence contracts/testing.md#independent-expectations Both authored identifier ranges and unchanged source with zero edits independently preserve the conservative multi-declaration policy.
// @evidence contracts/testing.md#distinguishing-cases Two separate declarations sharing one keyword differ from one stable identifier or one wholly stable destructuring declaration.
// @evidence contracts/testing.md#execution-ownership TestFixPreferConstSkipsMultiDeclarationList invokes assertNoFixSnapshot on the checker-backed left/right fixture.
func TestFixPreferConstSkipsMultiDeclarationList(t *testing.T) {
  source := "let left = 1, right = 2;\nJSON.stringify(left + right);\n"
  assertNoFixSnapshot(t, "prefer-const", source)
  _, _, findings := runRuleFindingsSnapshot(t, "prefer-const", source, nil)
  if len(findings) != 2 {
    t.Fatalf("want both declaration findings, got %+v", findings)
  }
  for index, expected := range []struct{ start, end int }{{4, 8}, {14, 19}} {
    if finding := findings[index]; finding.Pos != expected.start || finding.End != expected.end {
      t.Fatalf("finding %d: want [%d,%d), got %+v", index, expected.start, expected.end, finding)
    }
  }
}
