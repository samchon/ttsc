package linthost

import "testing"

// TestFixNoImportTypeSideEffectsPreservesLeadingComment verifies the
// multi-edit fix skips trivia when locating each specifier modifier.
//
// Each deletion must start at the actual inline type modifier after its
// leading trivia. Matching the word type inside a block comment would damage
// that comment and leave the modifier in place. The authored result keeps
// both comments and both type names while hoisting one clause modifier.
//
//  1. Parse a source file whose specifiers carry leading block comments
//     containing the word `type` plus inline `type` modifiers.
//  2. Apply the fix through the disk-backed fixer.
//  3. Assert the comments survive verbatim and the hoist produced the
//     canonical `import type { Foo, Bar }` shape.
//
// @evidence contracts/testing.md#behavioral-verification The inline-type hoist preserves block comments containing the misleading word type before both specifiers.
// @evidence contracts/testing.md#independent-expectations Literal comments survive byte-for-byte while only actual type modifiers disappear; the expected full source is authored independently.
// @evidence contracts/testing.md#distinguishing-cases Comment words must not become deletion anchors; both Foo and Bar carry leading trivia and the ordinary no-comment hoist is the companion case.
// @evidence contracts/testing.md#execution-ownership TestFixNoImportTypeSideEffectsPreservesLeadingComment calls assertFixSnapshot for the import rule against its temporary multiline fixture.
func TestFixNoImportTypeSideEffectsPreservesLeadingComment(t *testing.T) {
  assertFixSnapshot(
    t,
    "typescript/no-import-type-side-effects",
    "import {\n  /* type alias for Foo */ type Foo,\n  /* type alias for Bar */ type Bar,\n} from \"./mod\";\nconst x: Foo | null = null;\nconst y: Bar | null = null;\nJSON.stringify([x, y]);\n",
    "import type {\n  /* type alias for Foo */ Foo,\n  /* type alias for Bar */ Bar,\n} from \"./mod\";\nconst x: Foo | null = null;\nconst y: Bar | null = null;\nJSON.stringify([x, y]);\n",
  )
}
