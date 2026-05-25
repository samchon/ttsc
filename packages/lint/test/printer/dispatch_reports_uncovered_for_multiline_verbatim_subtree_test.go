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
// abstains on. A multi-line verbatim node — here an `if` statement
// inside a callback body — keeps the source columns its lines were
// written at, so a reflow that re-indented everything around it would
// produce inconsistently indented output. The dispatcher must surface
// that hazard as `covered == false`; a regression that returned `true`
// would let the rule emit a corrupt edit.
//
//  1. Parse a call whose callback body contains a multi-line `if`
//     statement (no per-node printer, spans several source lines).
//  2. Dispatch the CallExpression through PrintNode.
//  3. Assert the returned `covered` flag is false.
func TestDispatchReportsUncoveredForMultilineVerbatimSubtree(t *testing.T) {
  file := parseTS(t, "run(() => {\n  if (k) {\n    a();\n  }\n});\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  _, covered := PrintNode(ctx, node)
  if covered {
    t.Fatalf("subtree with multi-line verbatim if-statement must be uncovered")
  }
}
