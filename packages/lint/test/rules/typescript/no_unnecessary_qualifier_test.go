package linthost

import "testing"

// TestRuleCorpusTypescriptNoUnnecessaryQualifier verifies the lint rule
// corpus fixture typescript-no-unnecessary-qualifier.ts.
//
// The rule is AST-only: `Foo.Bar` written inside `namespace Foo { ... }`
// or `enum Foo { ..., X = Foo.Y, ... }` references the same lexical
// scope the access lives in, so dropping the `Foo.` qualifier leaves
// the identical binding lookup. The check climbs `Parent` links to find
// a matching enclosing declaration.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its `// expect:` comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusTypescriptNoUnnecessaryQualifier(t *testing.T) {
  assertRuleCorpusCase(t, "typescript-no-unnecessary-qualifier.ts",
    "// Positive: `Foo.Bar` referenced from inside `namespace Foo` — the\n"+
      "// `Foo.` qualifier names the enclosing scope and is redundant.\n"+
      "namespace Foo {\n"+
      "  export const Bar = 1;\n"+
      "  // expect: typescript/no-unnecessary-qualifier error\n"+
      "  export const alias = Foo.Bar;\n"+
      "}\n"+
      "\n"+
      "// Positive: enum member referenced from inside the same `enum` body\n"+
      "// via `enum E { X, Y = E.X }`.\n"+
      "enum Color {\n"+
      "  Red = 1,\n"+
      "  // expect: typescript/no-unnecessary-qualifier error\n"+
      "  Crimson = Color.Red,\n"+
      "}\n"+
      "\n"+
      "// Negative: `Foo.Bar` referenced from outside `namespace Foo` — the\n"+
      "// qualifier is the only way to reach the member.\n"+
      "const outside = Foo.Bar;\n"+
      "\n"+
      "// Negative: an unrelated qualified access whose head does not name\n"+
      "// any enclosing scope.\n"+
      "namespace Outer {\n"+
      "  export namespace Inner {\n"+
      "    export const value = 1;\n"+
      "  }\n"+
      "  // The qualifier `Inner` is the path into the inner namespace — the\n"+
      "  // enclosing scope is `Outer`, not `Inner`, so this is fine.\n"+
      "  export const fine = Inner.value;\n"+
      "}\n"+
      "\n"+
      "JSON.stringify({ outside, outer: Outer.Inner.value, alias: Foo.alias });\n")
}
