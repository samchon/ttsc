package linthost

import "testing"

// TestFormatTrailingCommaSkipsArrayRestAssignmentTarget verifies the rule
// adds no trailing comma to a multi-line array destructuring assignment
// target ending in a rest (`[a, ...rest] = arr`).
//
// The array analogue of the object rest-target hazard: it parses as an
// ArrayLiteralExpression with a trailing SpreadElement, which the rule
// visits, yet a comma after the AssignmentRestElement is a syntax error.
// isRestAssignmentTargetLiteral suppresses the insert; the valid source
// must survive unchanged.
//
// 1. Parse a multi-line array destructuring assignment target with a rest.
// 2. Run the rule.
// 3. Assert zero findings, so no fix corrupts the source.
func TestFormatTrailingCommaSkipsArrayRestAssignmentTarget(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/trailing-comma",
    "[\n  aa,\n  ...arest\n] = arr;\n",
  )
}
