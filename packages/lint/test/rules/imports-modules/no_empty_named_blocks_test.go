package linthost

import "testing"

// TestRuleCorpusNoEmptyNamedBlocks verifies the lint rule corpus fixture
// no-empty-named-blocks.ts.
//
// Empty named clauses come in three syntactic shapes the rule must catch:
// a bare `import {} from "x"`, a default-binding-plus-empty-clause
// `import name, {} from "x"`, and a bare `export {}`. None of them
// introduce a binding; the first two leave only the side-effect load
// (which a bare `import "x"` expresses without the empty braces), and the
// third either restates module-ness redundantly or marks an otherwise
// non-module file in a way that has cleaner alternatives.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification Engine reports empty bare/default import clauses and redundant empty export, while permitting nonempty named and clause-free side-effect imports.
// @evidence contracts/testing.md#independent-expectations An empty named clause contributes no binding; fixture annotations identify the unnecessary braces independently of the rule walk.
// @evidence contracts/testing.md#distinguishing-cases Three positive syntax shapes contrast with actual named bindings and a side-effect import lacking braces.
// @evidence contracts/testing.md#execution-ownership assertRuleCorpusCase runs the embedded empty and nonempty clause fixture through the rule engine and compares the authored rule/severity/line triples. This Test owns all three marked violations and both unmarked controls.
func TestRuleCorpusNoEmptyNamedBlocks(t *testing.T) {
  assertRuleCorpusCase(t, "no-empty-named-blocks.ts", "// Positive: empty named import clause without a default — the only\n// effect is to load the module for its side effects, which `import \"x\"`\n// expresses more clearly.\n// expect: no-empty-named-blocks error\nimport {} from \"x\";\n\n// Positive: empty named import clause alongside a default binding —\n// the `{}` adds nothing once the default is present.\n// expect: no-empty-named-blocks error\nimport defaultBinding, {} from \"y\";\nvoid defaultBinding;\n\n// Positive: empty `export {}` once the file is already a module via\n// some other import/export — restates module-ness redundantly.\n// expect: no-empty-named-blocks error\nexport {};\n\n// Negative: non-empty named import — the rule only fires on empty clauses.\nimport { join } from \"z\";\nvoid join;\n\n// Negative: a side-effect import with no clause at all — the rule\n// targets only the named-clause shape, not bare imports.\nimport \"w\";\n")
}
