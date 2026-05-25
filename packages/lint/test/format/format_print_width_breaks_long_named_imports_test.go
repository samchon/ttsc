package linthost

import "testing"

// TestFormatPrintWidthBreaksLongNamedImports verifies a wide
// `import { … } from "x";` declaration reflows to a multi-line clause.
//
// The case threads through both the ImportDeclaration printer (keyword,
// `from`, module specifier, semicolon) and the NamedImports printer
// (bracket reflow). A regression at either join would corrupt the
// declaration in a different way: dropping the `from` keyword would
// produce invalid syntax, while dropping the brackets would silently
// expose unbracketed specifiers.
//
//  1. Configure printWidth=30.
//  2. Feed `import { alpha, bravo, charlie } from "x";`.
//  3. Assert the rewrite is the canonical broken clause.
func TestFormatPrintWidthBreaksLongNamedImports(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "formatPrintWidth",
    "import { alpha, bravo, charlie } from \"x\";\n",
    `{"printWidth": 30}`,
    "import {\n  alpha,\n  bravo,\n  charlie,\n} from \"x\";\n",
  )
}
