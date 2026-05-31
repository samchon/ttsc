package linthost

import "testing"

// TestFormatReflowPreservesImportDefaultGapComment pins the data-safety guard
// for a comment in the default-binding-to-brace gap of a combined import
// (`import D /* c */, { … }`). At a narrow printWidth the default+named clause
// would reflow and the minted `, ` prefix would drop the comment; the gap is not
// a direct child of the import node so the outer scan masks it. The guard
// abstains, keeping the bytes verbatim.
func TestFormatReflowPreservesImportDefaultGapComment(t *testing.T) {
  assertFormatUnchangedWithFormat(
    t,
    `import D /* c */, { alpha, bravo, charlie } from "x";
`,
    map[string]any{"printWidth": 10},
  )
}
