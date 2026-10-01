package linthost

import "testing"

// TestBanTsCommentPragmaWinsOverErrorSuppressionMatch verifies one comment
// yields at most one directive, with the pragma matcher tried first.
//
// Upstream's valid case embeds a no-op `// @ts-ignore` in the description
// of an allowed `@ts-check` pragma: the comment classifies as `check` and
// nothing else, so the default `ts-ignore: true` policy must not fire on
// the embedded mention.
//
//  1. Configure `ts-check: "allow-with-description"` (ignore stays default
//     true).
//  2. Lint the pragma whose description mentions `// @ts-ignore`.
//  3. Assert zero findings.
//
// @evidence contracts/testing.md#behavioral-verification A recognized described ts-check pragma prevents an embedded later ts-ignore mention being treated as a separate suppression.
// @evidence contracts/testing.md#independent-expectations The authored comment has one effective leading pragma; its description includes inert ignore-shaped text. The configured allowance therefore requires zero findings.
// @evidence contracts/testing.md#distinguishing-cases A second directive-like substring in the same comment distinguishes whole-comment precedence from repeated substring matching.
// @evidence contracts/testing.md#execution-ownership assertRuleSkipsSourceWithOptions executes the exact precedence fixture and this Test owns the zero result. No consumer install or native product-host build/launch is used.
func TestBanTsCommentPragmaWinsOverErrorSuppressionMatch(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "typescript/ban-ts-comment",
    "// @ts-check with a description and also with a no-op // @ts-ignore\nconst a = 1;\nJSON.stringify(a);\n",
    `{"minimumDescriptionLength": 3, "ts-check": "allow-with-description"}`,
  )
}
