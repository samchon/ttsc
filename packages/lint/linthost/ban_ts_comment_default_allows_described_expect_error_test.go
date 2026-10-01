package linthost

import "testing"

// TestBanTsCommentDefaultAllowsDescribedExpectError verifies typescript/ban-ts-comment
// accepts a described `@ts-expect-error` under the recommended defaults.
//
// The default `ts-expect-error` policy is `allow-with-description` with a
// three-character minimum, so a justified suppression must produce no
// finding. This is the false-positive half of issue #415: the old
// implementation reported every `@ts-expect-error` unconditionally.
//
// 1. Lint a line-comment directive followed by a real description.
// 2. Run the rule with severity-only configuration (defaults).
// 3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification Default ban-ts-comment permits a sufficiently described expect-error.
// @evidence contracts/testing.md#independent-expectations The authored explanation exceeds the default three-grapheme requirement; zero findings follows allow-with-description policy.
// @evidence contracts/testing.md#distinguishing-cases Positive allowance contrasts with TestBanTsCommentDefaultRequiresDescriptionForBareExpectError.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSource executes the exact described fixture and this entry owns the zero result. No consumer install or native product-host build/launch is used.
func TestBanTsCommentDefaultAllowsDescribedExpectError(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "typescript/ban-ts-comment",
    "// @ts-expect-error here is why the error is expected\nconst a: number = 1;\nJSON.stringify(a);\n",
  )
}
