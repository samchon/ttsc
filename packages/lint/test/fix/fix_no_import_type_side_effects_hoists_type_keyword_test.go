package linthost

import "testing"

// TestFixNoImportTypeSideEffectsHoistsTypeKeyword verifies the
// noImportTypeSideEffects fixer hoists per-specifier `type` modifiers
// into a single import-clause `type`.
//
// The fix emits one insertion (`" type"` after `import`) and one deletion
// per specifier (`type ` prefix). All edits must be non-overlapping. This
// test pins the multi-edit happy path that the round-1 infrastructure
// changes opened up.
//
// 1. Parse `import { type A, type B } from "./mod"`.
// 2. Apply the finding through the disk-backed fixer.
// 3. Assert the result hoists `type` to the clause level.
func TestFixNoImportTypeSideEffectsHoistsTypeKeyword(t *testing.T) {
  assertFixSnapshot(
    t,
    "no-import-type-side-effects",
    "import { type A, type B } from \"./mod\";\nconst x: A | null = null;\nconst y: B | null = null;\nJSON.stringify([x, y]);\n",
    "import type { A, B } from \"./mod\";\nconst x: A | null = null;\nconst y: B | null = null;\nJSON.stringify([x, y]);\n",
  )
}
