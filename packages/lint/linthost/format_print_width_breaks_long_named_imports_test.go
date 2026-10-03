package linthost

import "testing"

// TestFormatPrintWidthBreaksLongNamedImports verifies a wide
// `import { … } from "x";` declaration reflows to a multi-line clause.
//
// The ImportDeclaration printer owns the keyword, named-list brackets,
// `from`, module specifier and semicolon in one list group. The nested
// NamedImports target does not fire separately. Dropping either the
// module suffix or the named brackets would change the complete literal
// oracle, which preserves every binding and declaration token.
//
//  1. Configure printWidth=30.
//  2. Feed `import { alpha, bravo, charlie } from "x";`.
//  3. Assert the rewrite is the canonical broken clause.
//
// @evidence contracts/testing.md#behavioral-verification The rule must break the three named bindings at width 30 while preserving their order, the from clause, module string and semicolon. Complete output equality detects lost bindings or declaration punctuation.
// @evidence contracts/testing.md#independent-expectations The supported named-import layout breaks its specifier list while preserving the module suffix; the complete expected identifiers, punctuation and module are authored directly from the fixture, not reconstructed from the printer.
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
