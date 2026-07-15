package linthost

import "testing"

// TestFormatTrailingCommaSkipsObjectRestAssignmentTarget verifies the rule
// adds no trailing comma to a multi-line object destructuring assignment
// target ending in a rest (`({ a, ...rest } = obj)`).
//
// Such a target parses as an ObjectLiteralExpression with a trailing
// SpreadAssignment, so the rule visits it — but a comma after the
// AssignmentRestProperty is a syntax error (Node `--check` exits 1). The
// parameter-list rest guard did not reach this shape; isRestAssignmentTargetLiteral
// now suppresses it. The source is already valid and must be left untouched.
//
// 1. Parse a multi-line object destructuring assignment target with a rest.
// 2. Run the rule.
// 3. Assert zero findings, so no fix rewrites the source into invalid syntax.
func TestFormatTrailingCommaSkipsObjectRestAssignmentTarget(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "format/trailing-comma",
    "({\n  ra,\n  ...rrest\n} = obj);\n",
  )
}
