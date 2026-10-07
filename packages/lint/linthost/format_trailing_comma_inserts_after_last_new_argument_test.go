package linthost

import "testing"

// TestFormatTrailingCommaInsertsAfterLastNewArgument verifies the rule reaches
// multi-line `new Foo(...)` argument lists.
//
// A constructor call with arguments follows all-mode call punctuation. A new expression without an argument list has no comma position and must remain untouched.
//
// 1. Parse a source file with one multi-line `new` expression.
// 2. Apply the rule's finding through the disk-backed fixer.
// 3. Assert the full rewritten source gains the comma after the last argument.
// 4. Assert a no-parentheses new expression produces no finding.
//
// @evidence contracts/testing.md#behavioral-verification New Foo must gain a comma after its final argument 2 while retaining the constructor declaration, first argument and result use; a no-parentheses new expression must produce no finding.
// @evidence contracts/testing.md#independent-expectations Prettier all-mode permits terminal commas in broken new-expression arguments. The literal expected source independently preserves constructor and argument meaning.
// @evidence contracts/testing.md#distinguishing-cases The new expression has a present argument list, contrasting an added no-parentheses constructor no-finding case and ES5 new-argument removal.
// @evidence contracts/testing.md#execution-ownership TestFormatTrailingCommaInsertsAfterLastNewArgument owns its authored insertion source, complete expected edit output and no-argument-list negative in the public Go unit population. The syntax-only owning rule and edit application execute in one Go process without consumer installation, native artifact building or product-host children.
func TestFormatTrailingCommaInsertsAfterLastNewArgument(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "declare class Foo { constructor(a: number, b: number); }\nconst r = new Foo(\n  1,\n  2\n);\nr;\n",
    "declare class Foo { constructor(a: number, b: number); }\nconst r = new Foo(\n  1,\n  2,\n);\nr;\n",
  )
  assertRuleSkipsSource(t, "format/trailing-comma", "const r = new Foo;\n")
}
