package linthost

import "testing"

// TestFormatReflowPreservesImportTypeGapComment pins the data-safety guard for a
// comment in the `type`->`{` gap of a type-only import (`import type /* c */
// { … }`). The `type` keyword is an ImportClause modifier flag, not a child
// node, so the comment is masked by the top-level scan and the brace-scoped
// guard starts at `{`. At a narrow printWidth the multi-specifier clause would
// reflow and the minted `import type ` prefix would drop the comment; the guard
// abstains, keeping the bytes verbatim.
func TestFormatReflowPreservesImportTypeGapComment(t *testing.T) {
  assertFormatUnchangedWithFormat(
    t,
    `import type /* c */ { alpha, bravo, charlie } from "x";
`,
    map[string]any{"printWidth": 10},
  )
}
