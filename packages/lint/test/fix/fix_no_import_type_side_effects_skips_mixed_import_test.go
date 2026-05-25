package linthost

import "testing"

// TestFixNoImportTypeSideEffectsSkipsMixedImport verifies the round-2
// negative-path coverage for `noImportTypeSideEffects`.
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
func TestFixNoImportTypeSideEffectsSkipsMixedImport(t *testing.T) {
  assertRuleSkipsSource(
    t,
    "noImportTypeSideEffects",
    "import { type A, B } from \"./mod\";\nconst a: A | null = null;\nconst b = B;\nJSON.stringify([a, b]);\n",
  )
}
