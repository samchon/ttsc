package linthost

import "testing"

// TestFormatIndentIdempotentOnCorrectClassBody verifies an
// already-correct class method body produces zero edits.
//
// The class frame and the method block each contribute one level, so
// the literal four-space return must remain unchanged. This pins a
// fixed point of the dedicated rule, without running a formatter cascade
// or an external reference.
//
//  1. Parse a class whose method body is already at four spaces.
//  2. Run the rule.
//  3. Assert it emits no finding.
//
// @evidence contracts/testing.md#behavioral-verification format/indent must emit no findings for an already canonical class method return at four spaces. This assertion detects incorrectly forgetting the class-body level and de-indenting valid source.
// @evidence contracts/testing.md#independent-expectations The supported two-level class/method block layout independently puts the return at four spaces with the member header at two. No-finding is required because every owned leading run already matches that literal layout.
// @evidence contracts/testing.md#distinguishing-cases This canonical negative complements NormalizesClassMethodBodyDepth, whose flush-left return must change to the same four-space column. Idempotency here does not stand in for the positive repair.
// @evidence contracts/testing.md#execution-ownership TestFormatIndentIdempotentOnCorrectClassBody owns its canonical no-finding fixture in the public Go unit population. The syntax-only harness directly runs the owning rule in process without consumer installation, native production or a real product host.
func TestFormatIndentIdempotentOnCorrectClassBody(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/indent",
    "class C {\n  m() {\n    return 1;\n  }\n}\n",
  )
}
