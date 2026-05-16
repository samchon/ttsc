package linthost

import "testing"

// TestFormatPrintWidthPreservesTerminatorDecisionOnImports verifies the
// import-declaration printer preserves the user's `;` decision rather
// than appending one unconditionally.
//
// Originally `printImportDeclaration` emitted `Text(";")` at the tail
// of every reflowed import. On a project that also enabled
// `format/semi` with the default `prefer: "always"`, the cascade
// would emit a zero-width insert at the source's `node.End()` (no
// trailing `;`) while print-width's replacement bytes already
// contained `;`. The applier's overlap check passes both edits
// through, producing `;;`. Mirror Prettier's split-of-responsibility:
// reflow preserves syntax, terminator placement belongs to
// `format/semi`.
//
//  1. Configure printWidth=20 (the import would break either way).
//  2. Feed the import without a trailing `;` — `import { … } from "x"\n`.
//  3. Assert the rule's reflow still has no `;` after `"x"`. A second
//     fixture covers the with-`;` arm to pin idempotence.
func TestFormatPrintWidthPreservesTerminatorDecisionOnImports(t *testing.T) {
  // No-semi arm.
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "import { alpha, bravo, charlie } from \"x\"\n",
    `{"printWidth": 20}`,
    "import {\n  alpha,\n  bravo,\n  charlie,\n} from \"x\"\n",
  )
  // With-semi arm — pin that the reflow does not strip the terminator
  // either, so users running `ttsc format` without `format/semi`
  // enabled do not lose the semicolons they wrote.
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "import { alpha, bravo, charlie } from \"x\";\n",
    `{"printWidth": 20}`,
    "import {\n  alpha,\n  bravo,\n  charlie,\n} from \"x\";\n",
  )
}
