package linthost

import "testing"

// TestFormatTrailingCommaHonorsModeEs5SkipsNewArgument verifies the rule
// emits no findings on a multi-line `new` expression under `mode: "es5"`.
//
// `KindNewExpression` shares the call-argument grammar but routes through
// its own dispatch arm with an `ne.Arguments == nil` short-circuit; the
// es5 guard runs before that check. ES5 grammar disallowed trailing
// commas in argument lists, so prettier excludes them. Pinning the
// skip protects the peer arm alongside the call-expression case.
//
// 1. Parse a source file with one multi-line `new` expression.
// 2. Run the engine with `mode: "es5"` configured.
// 3. Assert zero findings.
func TestFormatTrailingCommaHonorsModeEs5SkipsNewArgument(t *testing.T) {
  assertRuleSkipsSourceWithOptions(
    t,
    "format/trailing-comma",
    "declare class Foo { constructor(a: number, b: number); }\nconst r = new Foo(\n  1,\n  2\n);\nr;\n",
    `{"mode":"es5"}`,
  )
}
