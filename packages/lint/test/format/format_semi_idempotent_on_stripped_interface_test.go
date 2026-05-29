package linthost

import "testing"

// TestFormatSemiIdempotentOnStrippedInterface verifies the member-strip
// path is idempotent: an interface already free of member semicolons
// produces zero findings under prefer:"never".
//
// Idempotency is the format cascade's convergence guarantee. Once the
// member `;` is gone there is no terminator to locate, so the rule must
// not re-report (which would loop the cascade).
//
//  1. Parse an interface whose members already lack `;`.
//  2. Run format/semi with prefer:"never".
//  3. Assert the rule reports nothing.
func TestFormatSemiIdempotentOnStrippedInterface(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/semi",
    "interface A {\n  a: number\n  b: string\n}\n",
    `{"prefer":"never"}`,
  )
}
