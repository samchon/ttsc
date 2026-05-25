package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastNewArgument verifies the rule reaches
// multi-line `new Foo(...)` argument lists.
//
// `new` expressions share the call-argument shape but go through a separate
// `KindNewExpression` dispatch arm. This test pins the non-nil-arguments
// path so a future refactor that consolidated the two arms cannot silently
// stop inserting for multi-line `new Foo(...)`; the `ne.Arguments == nil`
// short-circuit for `new Foo` (no parens) is a sibling concern that
// remains unpinned because no positive insert applies there.
//
// 1. Parse a source file with one multi-line `new` expression.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma after the last argument.
func TestFormatTrailingCommaInsertsAfterLastNewArgument(t *testing.T) {
  assertFixSnapshot(
    t,
    "formatTrailingComma",
    "declare class Foo { constructor(a: number, b: number); }\nconst r = new Foo(\n  1,\n  2\n);\nr;\n",
    "declare class Foo { constructor(a: number, b: number); }\nconst r = new Foo(\n  1,\n  2,\n);\nr;\n",
  )
}
