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
//
// @evidence contracts/testing.md#behavioral-verification Default ban-ts-comment ignores ts-nocheck after code has begun.
// @evidence contracts/testing.md#independent-expectations TypeScript file-check pragmas take effect before the first statement; the two authored late placements do not disable file checking.
// @evidence contracts/testing.md#distinguishing-cases Separate-line and inline late directives contrast with the before-code and statement-free positive siblings.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSource executes both late-placement fixtures; this entry owns both zero-result assertions. No consumer install or native product-host build/launch is used.
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
