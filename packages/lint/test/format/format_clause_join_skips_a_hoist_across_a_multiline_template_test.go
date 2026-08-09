package linthost

import "testing"

// TestFormatClauseJoinSkipsAHoistAcrossAMultilineTemplate verifies a body holding a multi-line template literal abstains from the join.
//
// The newlines inside a template carry string content, so shifting a line within
// one changes what the program prints rather than how it reads. Prettier does
// join this label; keeping the source is the deliberate trade, and abstaining
// from the whole join rather than the shift alone is what keeps the two halves
// from disagreeing.
//
//  1. Parse a label whose body passes a multi-line template literal.
//  2. Run format/clause-join with printWidth 80.
//  3. Assert the rule reports nothing.
func TestFormatClauseJoinSkipsAHoistAcrossAMultilineTemplate(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/clause-join",
    "outer:\n  run(`a\nb`);\n",
    `{"printWidth":80,"tabWidth":2}`,
  )
}
