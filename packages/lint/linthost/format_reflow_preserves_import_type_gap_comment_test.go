package linthost

import "testing"

// TestFormatReflowPreservesImportTypeGapComment verifies preservation of
// trivia between the type keyword and a named import brace.
//
// Rebuilding the type-only prefix must not delete its comment. A comment-free
// twin requires reflow while retaining type-only binding ownership.
//
// 1. Format the original type-gap comment at width ten without changing it.
// 2. Remove that comment and require the literal broken type import.
//
// @evidence contracts/testing.md#behavioral-verification The in-process format command must preserve the comment between type and the named import brace. The comment-free type import must break at width ten while retaining type-only ownership and every binding. The owned result is: Remove that comment and require the literal broken type import.
// @evidence contracts/testing.md#independent-expectations The authored type-gap comment must survive byte for byte. The independently authored literal fixes the supported type-only import break and trailing comma, preserving the module specifier and imported names.
// @evidence contracts/testing.md#distinguishing-cases The original type-keyword gap remains negative for reflow, with a comment-free twin positive under the same narrow width. The default-gap host distinguishes a different prefix region that also must retain trivia.
// @evidence contracts/testing.md#execution-ownership TestFormatReflowPreservesImportTypeGapComment owns the original and paired import fixtures plus width-ten options. Its helper directly invokes Go run in process and reads temporary project output and streams without consumer installation, native artifacts or a CLI child.
func TestFormatReflowPreservesImportTypeGapComment(t *testing.T) {
  assertFormatUnchangedWithFormat(
    t,
    `import type /* c */ { alpha, bravo, charlie } from "x";
`,
    map[string]any{"printWidth": 10},
  )
  assertFormatResultWithFormat(t,
    "import type { alpha, bravo, charlie } from \"x\";\n",
    "import type {\n  alpha,\n  bravo,\n  charlie,\n} from \"x\";\n",
    map[string]any{"printWidth": 10})
}
