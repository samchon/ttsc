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
//
// @evidence contracts/testing.md#behavioral-verification format/semi must offer no further edit for newline-separated interface members already lacking terminators under never.
// @evidence contracts/testing.md#independent-expectations The independent a:number and b:string source already satisfies semi:false broken-member layout; absence of a terminator is the canonical no-op oracle.
// @evidence contracts/testing.md#distinguishing-cases This unchanged two-member interface complements the actual semicolon-stripping positive, so the suite does not rely on idempotency alone.
// @evidence contracts/testing.md#execution-ownership TestFormatSemiIdempotentOnStrippedInterface is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only fixture harness invokes the owning semicolon rule and observes zero findings in the same Go process without consumer installation, a native product build or a product host.
func TestFormatSemiIdempotentOnStrippedInterface(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/semi",
    "interface A {\n  a: number\n  b: string\n}\n",
    `{"prefer":"never"}`,
  )
}
