package linthost

import (
  "testing"
)

// TestUnicornPreferSimpleConditionFirstParserAwareCommentsDoNotMistakeLiteralText verifies comment safety uses parser positions rather than literal text.
//
// Literal text cannot act as a source comment; authored expected edits and warning/no-fix cases independently distinguish parser-aware safety.
//
// 1. Execute the retained logical source variants through the owning Go rule.
// 2. Compare the diagnostic/edit or unchanged result at each stated boundary.
//
// @evidence contracts/testing.md#behavioral-verification The actual fixer must reorder operands containing quoted comment-looking text and match the entire authored source, detecting mistaken comment recognition.
// @evidence contracts/testing.md#independent-expectations Text inside a string literal is not a source comment in JavaScript; the authored full-source output, in which the quoted-comment-looking conditional is moved after `other`, is independent of the fixer.
// @evidence contracts/testing.md#distinguishing-cases Quoted // and /* text remains eligible for this exact edit; WithholdsUnsafeAndSyntaxOwnedFixes owns real source-comment no-fix counterparts.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreferSimpleConditionFirstParserAwareCommentsDoNotMistakeLiteralText owns the literal logical-expression variants as a discoverable Go unit entry; actual parser/engine/fix operations run in the shared process without a consumer installation, native producer or product child host.
func TestUnicornPreferSimpleConditionFirstParserAwareCommentsDoNotMistakeLiteralText(t *testing.T) {
  source := `declare const ready: boolean;
declare const other: boolean;
if ((ready ? "//" : "/*") && other) { void 0; }
`
  expected := `declare const ready: boolean;
declare const other: boolean;
if (other && (ready ? "//" : "/*")) { void 0; }
`
  assertFixSnapshot(t, preferSimpleConditionFirstRule, source, expected)
}
