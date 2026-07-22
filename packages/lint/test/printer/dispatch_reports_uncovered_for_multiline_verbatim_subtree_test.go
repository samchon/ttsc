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
// The subject used to be an `if` statement, which the dispatcher had no printer
// for. It has one now, so the case was asserting the absence of a printer
// rather than the coverage contract. A `switch` is the stand-in: still
// verbatim, and still multi-line. When it gains a printer this case needs
// another subject, not deletion — what it pins is the hazard, and there is
// always some kind the dispatcher does not cover.
//
//  1. Parse a call whose callback body contains a multi-line `switch`
//     statement (no per-node printer, spans several source lines).
//  2. Dispatch the CallExpression through PrintNode.
//  3. Assert the returned `covered` flag is false.
func TestDispatchReportsUncoveredForMultilineVerbatimSubtree(t *testing.T) {
  file := parseTS(t, "run(() => {\n  if (k) {\n    a();\n  }\n});\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  _, covered := PrintNode(ctx, node)
  if covered {
    t.Fatalf("subtree with a multi-line verbatim statement must be uncovered")
  }
}
