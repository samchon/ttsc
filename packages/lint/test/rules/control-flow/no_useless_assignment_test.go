package linthost

import "testing"

// TestRuleCorpusNoUselessAssignment verifies the lint rule corpus fixture
// no-useless-assignment.ts.
//
// The rule visits every Block and inspects consecutive statement pairs:
// when both statements are `<ident> = <expr>;` assignments to the same
// bare identifier and the second statement's right-hand side does not
// reference that identifier, the first assignment is reported as a
// dead store.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoUselessAssignment(t *testing.T) {
	assertRuleCorpusCase(t, "no-useless-assignment.ts", "function deadStore(): number {\n  let x = 0;\n  // expect: no-useless-assignment error\n  x = 1;\n  x = 2;\n  return x;\n}\nfunction readsPrior(): number {\n  let x = 0;\n  x = 1;\n  x = x + 2;\n  return x;\n}\nfunction withInterleavedRead(): number {\n  let x = 0;\n  x = 1;\n  JSON.stringify(x);\n  x = 2;\n  return x;\n}\nfunction differentTargets(): number {\n  let a = 0;\n  let b = 0;\n  a = 1;\n  b = 2;\n  return a + b;\n}\nJSON.stringify({ deadStore, readsPrior, withInterleavedRead, differentTargets });\n")
}
