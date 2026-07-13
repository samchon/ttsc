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
func TestBanTsCommentPragmaWinsOverErrorSuppressionMatch(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "typescript/ban-ts-comment",
    "// @ts-check with a description and also with a no-op // @ts-ignore\nconst a = 1;\nJSON.stringify(a);\n",
    `{"minimumDescriptionLength": 3, "ts-check": "allow-with-description"}`,
  )
}
