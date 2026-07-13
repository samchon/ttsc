package linthost

import "testing"

// TestRuleCorpusNoVarLoopHeaders verifies the lint rule corpus fixture
// no-var-loop-headers.ts.
//
// Loop-header `var` lists (`for`, `for...in`, `for...of`) are
// VariableDeclarationList nodes owned by the loop statement, not
// VariableStatement nodes, so a rule registered on the statement kind alone
// never saw them (issue #409). This case pins one diagnostic per loop form
// and — via the corpus helper's exact-match contract — zero diagnostics for
// the `let`/`const` header negative twins below them.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoVarLoopHeaders(t *testing.T) {
  assertRuleCorpusCase(
    t,
    "no-var-loop-headers.ts",
    "// expect: no-var error\nfor (var index = 0; index < 1; index += 1) {\n  JSON.stringify(index);\n}\n\n// expect: no-var error\nfor (var key in { value: 1 }) {\n  JSON.stringify(key);\n}\n\n// expect: no-var error\nfor (var value of [1]) {\n  JSON.stringify(value);\n}\n\nfor (let safeIndex = 0; safeIndex < 1; safeIndex += 1) {\n  JSON.stringify(safeIndex);\n}\n\nfor (const safeKey in { value: 1 }) {\n  JSON.stringify(safeKey);\n}\n\nfor (const safeValue of [1]) {\n  JSON.stringify(safeValue);\n}\n",
  )
}
