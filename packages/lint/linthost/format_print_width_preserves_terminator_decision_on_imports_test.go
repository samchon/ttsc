package linthost

import "testing"

// TestFormatPrintWidthPreservesTerminatorDecisionOnImports verifies the
// import-declaration printer preserves the user's `;` decision rather
// than appending one unconditionally.
//
// printImportDeclaration includes the terminator only when it exists
// in the source. These two changing fixtures require preservation in
// both directions. The combined semi/print-width command is owned by
// the separate cascade host, not observed by this rule-only entry.
//
//  1. Configure printWidth=20 (the import would break either way).
//  2. Feed the import without a trailing `;` — `import { … } from "x"\n`.
//  3. Assert the rule's reflow still has no `;` after `"x"`. A second
//     fixture covers the with-`;` arm to pin idempotence.
//
// @evidence contracts/testing.md#behavioral-verification Both overflowing imports must break while preserving the original absence or presence of a semicolon. Complete output comparisons detect either an invented terminator or a lost existing terminator, independently of a formatting fixed point.
// @evidence contracts/testing.md#independent-expectations The two complete layout literals independently retain each authored source terminator decision. The rule itself receives only printWidth:20 and preserves source termination; semi policy belongs to the separate semi rule, so this is no claim that print-width applies Prettier default semicolon policy.
// @evidence contracts/testing.md#distinguishing-cases The two inputs differ only in the source semicolon and both require a transformation. They distinguish terminator preservation in both directions; the command-format cascade host separately exercises combined print-width/semi/quote behavior.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthPreservesTerminatorDecisionOnImports owns both named literal arms through the registered in-process rule engine and full applied-output helper. Its branches are directly reachable from one selected public Go Test without product-host children.
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
