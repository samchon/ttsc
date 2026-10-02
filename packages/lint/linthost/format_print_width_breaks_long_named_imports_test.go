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
//
// @evidence contracts/testing.md#behavioral-verification The rule must break the three named bindings at width 30 while preserving their order, the from clause, module string and semicolon. Complete output equality detects lost bindings or declaration punctuation.
// @evidence contracts/testing.md#independent-expectations Installed Prettier 3.8.3 independently produces the literal multiline import at width 30; the expected identifiers and module are authored directly from the fixture, not reconstructed from the printer.
// @evidence contracts/testing.md#distinguishing-cases This host owns the named-only overflowing import. The default-plus-named host owns its additional binding prefix, and the namespace host supplies a long but indivisible no-reflow alternative.
// @evidence contracts/testing.md#execution-ownership TestFormatPrintWidthBreaksLongNamedImports owns one complete source rewrite through the registered rule engine, fixture parser and fix applier in the Go test process. No installed consumer, native build or real host child participates.
func TestFormatPrintWidthBreaksLongNamedImports(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/print-width",
    "import { alpha, bravo, charlie } from \"x\";\n",
    `{"printWidth": 30}`,
    "import {\n  alpha,\n  bravo,\n  charlie,\n} from \"x\";\n",
  )
}
