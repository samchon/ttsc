package linthost

import "testing"

// TestFixNoImportTypeSideEffectsSkipsCommentImportKeyword verifies the
// `import` keyword anchor ignores the word `import` in leading trivia.
//
// The keyword position was found via a raw byte scan from node.Pos(), which
// includes leading trivia. A leading comment containing the word `import`
// (`// re-import below`) matched first, so the ` type` insertion landed inside
// the comment while the specifier loop still stripped each `type ` — silently
// converting the type-only imports back into value imports. Anchoring at
// keywordStart (SkipTrivia past comments) lands on the real `import` token.
//
//  1. Parse a leading line comment containing `import` before
//     `import { type Foo, type Bar } from "./mod";`.
//  2. Apply the fix through the disk-backed fixer.
//  3. Assert the comment is untouched and the statement collapses to
//     `import type { Foo, Bar } from "./mod";` (still type-only).
func TestFixNoImportTypeSideEffectsSkipsCommentImportKeyword(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/no-import-type-side-effects",
    "// re-import below\nimport { type Foo, type Bar } from \"./mod\";\nconst x: Foo | null = null;\nconst y: Bar | null = null;\nJSON.stringify([x, y]);\n",
    "// re-import below\nimport type { Foo, Bar } from \"./mod\";\nconst x: Foo | null = null;\nconst y: Bar | null = null;\nJSON.stringify([x, y]);\n",
  )
}
