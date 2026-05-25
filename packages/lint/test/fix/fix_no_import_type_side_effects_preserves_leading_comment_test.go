package linthost

import "testing"

// TestFixNoImportTypeSideEffectsPreservesLeadingComment verifies the
// round-2 trivia-skip repair for the multi-edit fix.
//
// Pre-repair, the per-specifier `type` keyword was located via the
// raw byte-scanner `findKeyword`, which is identifier-aware but NOT
// comment-aware. A specifier preceded by a block comment containing
// the word `type` (e.g. `/* type alias for Foo */ type Foo`) matched
// inside the comment and the fix deleted 4–5 bytes from the comment
// while leaving the actual modifier in place — corrupting the source
// to an invalid `import type { /* */ type Foo, type Bar }`. The
// round-2 fix uses `shimscanner.SkipTrivia` to land on the first
// token byte, which honors comments as trivia.
//
//  1. Parse a source file whose specifiers carry leading block comments
//     containing the word `type` plus inline `type` modifiers.
//  2. Apply the fix through the disk-backed fixer.
//  3. Assert the comments survive verbatim and the hoist produced the
//     canonical `import type { Foo, Bar }` shape.
func TestFixNoImportTypeSideEffectsPreservesLeadingComment(t *testing.T) {
  assertFixSnapshot(
    t,
    "noImportTypeSideEffects",
    "import {\n  /* type alias for Foo */ type Foo,\n  /* type alias for Bar */ type Bar,\n} from \"./mod\";\nconst x: Foo | null = null;\nconst y: Bar | null = null;\nJSON.stringify([x, y]);\n",
    "import type {\n  /* type alias for Foo */ Foo,\n  /* type alias for Bar */ Bar,\n} from \"./mod\";\nconst x: Foo | null = null;\nconst y: Bar | null = null;\nJSON.stringify([x, y]);\n",
  )
}
