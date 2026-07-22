package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchReportsUncoveredForMultilineVerbatimSubtree verifies
// PrintNode reports `covered == false` when the printed subtree buries
// a multi-line node the dispatcher has no printer for.
//
// The `covered` flag is the safety signal the formatPrintWidth rule
// abstains on. A multi-line verbatim node keeps the source columns its lines
// were written at, so a reflow that re-indented everything around it would
// produce inconsistently indented output. The dispatcher must surface that
// hazard as `covered == false`; a regression that returned `true` would let the
// rule emit a corrupt edit.
//
// The subject moved from `if` to `switch` as those printers landed. A `do`
// statement is the stand-in now: still verbatim and still multi-line. When it
// gains a printer this case needs another subject, not deletion. What it pins
// is the hazard, and there is always some kind the dispatcher does not cover.
//
//  1. Parse a call whose callback body contains a multi-line `do`
//     statement (no per-node printer, spans several source lines).
//  2. Dispatch the CallExpression through PrintNode.
//  3. Assert the returned `covered` flag is false.
func TestDispatchReportsUncoveredForMultilineVerbatimSubtree(t *testing.T) {
  file := parseTS(t, "run(() => {\n  do {\n    a();\n  } while (ready);\n});\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  _, covered := PrintNode(ctx, node)
  if covered {
    t.Fatalf("subtree with a multi-line verbatim statement must be uncovered")
  }
}
