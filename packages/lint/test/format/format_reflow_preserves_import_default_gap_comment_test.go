package linthost

import "testing"

// TestFormatReflowPreservesImportDefaultGapComment verifies preservation of
// trivia between a default import binding and its named import list.
//
// Rebuilding the combined import prefix must not delete its comment. The same
// declaration without that comment must still break under a narrow width.
//
// 1. Format the original default-gap comment at width ten without changing it.
// 2. Format its comment-free twin and require the literal broken named list.
//
// @evidence contracts/testing.md#behavioral-verification The in-process format command must retain the comment between the default binding and named import list. A comment-free combined import must reflow at width ten, detecting lost gap trivia or blanket import abstention. The owned result is: Format its comment-free twin and require the literal broken named list. .
// @evidence contracts/testing.md#independent-expectations The original comment and binding order are authored bytes that must survive. Installed Prettier 3.8.3 supplies the literal narrow-width combined-import output, retaining default binding, named bindings and module specifier.
// @evidence contracts/testing.md#distinguishing-cases The original default-binding gap comment stays negative for reflow; the same combined import without that comment is positive at width ten. ImportTypeGapComment independently covers the type-keyword boundary.
// @evidence contracts/testing.md#execution-ownership TestFormatReflowPreservesImportDefaultGapComment owns both source/output fixtures and printWidth ten. Its helper directly calls Go run in process and observes temporary project files and streams, without native builds, consumer installations or a product-host child.
func TestFormatReflowPreservesImportDefaultGapComment(t *testing.T) {
  assertFormatUnchangedWithFormat(
    t,
    `import D /* c */, { alpha, bravo, charlie } from "x";
`,
    map[string]any{"printWidth": 10},
  )
  assertFormatResultWithFormat(t,
    "import D, { alpha, bravo, charlie } from \"x\";\n",
    "import D, {\n  alpha,\n  bravo,\n  charlie,\n} from \"x\";\n",
    map[string]any{"printWidth": 10})
}
