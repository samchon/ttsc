package linthost

import "testing"

// TestFixNoImportTypeSideEffectsSkipsCommentImportKeyword verifies the
// `import` keyword anchor ignores the word `import` in leading trivia.
//
// The clause insertion must follow the real import token while the separate
// specifier edits remove each inline type modifier. A keyword lookalike in
// leading trivia must not redirect that insertion into the comment or leave
// a value import. The expected full source checks both the retained comment
// and the resulting type-only declaration.
//
//  1. Parse a leading line comment containing `import` before
//     `import { type Foo, type Bar } from "./mod";`.
//  2. Apply the fix through the disk-backed fixer.
//  3. Assert the comment is untouched and the statement collapses to
//     `import type { Foo, Bar } from "./mod";` (still type-only).
//
// @evidence contracts/testing.md#behavioral-verification The import-type hoist ignores import inside the leading re-import comment and inserts type after the real keyword.
// @evidence contracts/testing.md#independent-expectations The literal line comment remains unchanged and the exact import type { Foo, Bar } result preserves type-only meaning.
// @evidence contracts/testing.md#distinguishing-cases Leading keyword lookalikes differ from the actual import token; the specifier-comment case covers the deletion-side trivia boundary.
// @evidence contracts/testing.md#execution-ownership TestFixNoImportTypeSideEffectsSkipsCommentImportKeyword calls assertFixSnapshot; actual Engine findings and applyFindingFixes own the source rewrite.
func TestFixNoImportTypeSideEffectsSkipsCommentImportKeyword(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/no-import-type-side-effects",
    "// re-import below\nimport { type Foo, type Bar } from \"./mod\";\nconst x: Foo | null = null;\nconst y: Bar | null = null;\nJSON.stringify([x, y]);\n",
    "// re-import below\nimport type { Foo, Bar } from \"./mod\";\nconst x: Foo | null = null;\nconst y: Bar | null = null;\nJSON.stringify([x, y]);\n",
  )
}
