package linthost

import "testing"

// TestFixNoImportTypeSideEffectsHoistsTypeKeyword verifies the
// noImportTypeSideEffects fixer hoists per-specifier `type` modifiers
// into a single import-clause `type`.
//
// Hoisting requires one clause insertion and one deletion per specifier.
// The full source expectation verifies that these edits compose without
// leaving an inline modifier, losing a type name or changing the later
// type annotations and value expressions.
//
// 1. Parse `import { type A, type B } from "./mod"`.
// 2. Apply the finding through the disk-backed fixer.
// 3. Assert the result hoists `type` to the clause level.
//
// @evidence contracts/testing.md#behavioral-verification typescript/no-import-type-side-effects hoists the two inline type modifiers to one clause modifier.
// @evidence contracts/testing.md#independent-expectations The independently authored import type { A, B } result preserves both downstream type annotations and uses.
// @evidence contracts/testing.md#distinguishing-cases Two specifiers require one insertion and two deletions together; mixed value/type imports are a separate zero-finding boundary.
// @evidence contracts/testing.md#execution-ownership TestFixNoImportTypeSideEffectsHoistsTypeKeyword runs assertFixSnapshot with the real import rule and applies its multi-edit group in process.
func TestFixNoImportTypeSideEffectsHoistsTypeKeyword(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/no-import-type-side-effects",
    "import { type A, type B } from \"./mod\";\nconst x: A | null = null;\nconst y: B | null = null;\nJSON.stringify([x, y]);\n",
    "import type { A, B } from \"./mod\";\nconst x: A | null = null;\nconst y: B | null = null;\nJSON.stringify([x, y]);\n",
  )
}
