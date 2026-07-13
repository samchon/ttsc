package linthost

import "testing"

// TestFixPreferAsConstSkipsTemplateLiteralAssertion verifies preferAsConst ignores template-literal assertions.
//
// Upstream compares ESTree `Literal` nodes only; a no-substitution template
// is a `TemplateLiteral` on both sides, so a template literal asserted to
// its identically spelled template literal type is a valid upstream
// fixture. The rule previously matched the shared source text and rewrote
// the template type to `const`; this pins the corrected boundary.
//
//  1. Parse a source file with a template literal asserted to a template
//     literal type of identical spelling.
//  2. Run preferAsConst with the engine.
//  3. Assert zero findings.
func TestFixPreferAsConstSkipsTemplateLiteralAssertion(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "typescript/prefer-as-const",
    "const value = `literal` as `literal`;\nJSON.stringify(value);\n",
  )
}
