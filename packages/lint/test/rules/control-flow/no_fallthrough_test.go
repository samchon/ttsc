package linthost

import "testing"

// TestRuleCorpusNoFallthrough verifies the lint rule corpus fixture no-fallthrough.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// The fixture pins the three headline behaviors in one switch: an unmarked reachable
// fallthrough reports (its trailing `// @ts-ignore` comment is unrelated and must not
// suppress), a `// falls through` marker suppresses the next transition, and an `if/else`
// whose branches all `return` / `throw` terminates the case without a `break`.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoFallthrough(t *testing.T) {
  assertRuleCorpusCase(t, "no-fallthrough.ts", "declare const condition: boolean;\n\nfunction f(x: number) {\n  switch (x) {\n    case 1:\n      console.log(\"one\");\n    // expect: no-fallthrough error\n    // @ts-ignore\n    case 2:\n      console.log(\"two\");\n      // falls through\n    case 3:\n      if (condition) {\n        return;\n      } else {\n        throw new Error(\"stop\");\n      }\n    case 4:\n      console.log(\"four\");\n      break;\n  }\n}\nJSON.stringify(f);\n")
}
