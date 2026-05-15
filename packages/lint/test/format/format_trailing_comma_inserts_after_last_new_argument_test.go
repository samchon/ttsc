package main

import "testing"

// TestFormatTrailingCommaInsertsAfterLastNewArgument verifies the rule reaches
// multi-line `new Foo(...)` argument lists.
//
// `new` expressions share the call-argument shape but go through a separate
// `KindNewExpression` dispatch arm with an `ne.Arguments == nil` short-circuit
// for the `new Foo` (no-parens) form. Pinning the positive insert here keeps
// that arm regression-safe alongside the `KindCallExpression` peer — a future
// refactor that consolidated the two could otherwise miss the `Arguments` nil
// guard and silently stop inserting for the most common multi-line `new`
// shape.
//
// 1. Parse a source file with one multi-line `new` expression.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the rewritten file contains the trailing comma after the last argument.
func TestFormatTrailingCommaInsertsAfterLastNewArgument(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "declare class Foo { constructor(a: number, b: number); }\nconst r = new Foo(\n  1,\n  2\n);\nr;\n",
    "declare class Foo { constructor(a: number, b: number); }\nconst r = new Foo(\n  1,\n  2,\n);\nr;\n",
  )
}
