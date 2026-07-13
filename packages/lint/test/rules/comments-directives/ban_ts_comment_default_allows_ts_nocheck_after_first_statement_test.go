package linthost

import "testing"

// TestBanTsCommentDefaultAllowsTsNocheckAfterFirstStatement verifies
// typescript/ban-ts-comment skips `@ts-nocheck` at or after the first statement.
//
// The compiler only honors the nocheck pragma before the first statement;
// upstream compares source lines, so both a later line and a trailing
// comment on the first statement's own line are inert and must stay
// unreported. Without this gate the rule would flag dead pragmas.
//
// 1. Lint a nocheck comment on a line after the first statement.
// 2. Lint a trailing nocheck comment on the first statement's line.
// 3. Assert zero findings for both.
func TestBanTsCommentDefaultAllowsTsNocheckAfterFirstStatement(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "typescript/ban-ts-comment",
    "const a = 1;\n\n// @ts-nocheck - should not be reported\n\nJSON.stringify(a);\n",
  )
  assertRuleSkipsSource(
    t,
    "typescript/ban-ts-comment",
    "const a = 1; // @ts-nocheck\nJSON.stringify(a);\n",
  )
}
