package linthost

import "testing"

// TestFixNoImportTypeSideEffectsSkipsMixedImport verifies the negative path
// of `no-import-type-side-effects` for a mixed import.
//
// The rule's canonical contract requires EVERY named specifier to carry
// the inline `type` modifier before hoisting is safe. A mixed import
// `{ type A, B }` would lose `B`'s value-import semantics if hoisted to
// `import type { A, B }`. The round-1 implementation correctly returned
// early at the per-specifier loop; this test pins that gate against a
// future refactor.
//
//  1. Parse an import declaration with one type-modified specifier and
//     one plain specifier.
//  2. Run the rule under the engine.
//  3. Assert zero findings — the gate must hold.
//
// @evidence contracts/testing.md#behavioral-verification The import-type rule emits no finding for { type A, B } and therefore cannot hoist B out of value space.
// @evidence contracts/testing.md#independent-expectations Literal mixed modifier inputs and zero findings establish the supported all-specifiers-type gate independently of fixer output.
// @evidence contracts/testing.md#distinguishing-cases One plain value specifier is enough to refuse the hoist; TestFixNoImportTypeSideEffectsHoistsTypeKeyword owns the all-type positive twin.
// @evidence contracts/testing.md#execution-ownership TestFixNoImportTypeSideEffectsSkipsMixedImport calls assertRuleSkipsSource, binding the actual Engine rule before parsing the source in process.
func TestFixNoImportTypeSideEffectsSkipsMixedImport(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "typescript/no-import-type-side-effects",
    "import { type A, B } from \"./mod\";\nconst a: A | null = null;\nconst b = B;\nJSON.stringify([a, b]);\n",
  )
}
