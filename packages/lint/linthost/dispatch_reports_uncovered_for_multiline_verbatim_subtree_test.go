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
// retain those frozen columns. The dispatcher must surface that hazard
// as `covered == false`. This test checks the enclosing call's flag;
// it does not run the format rule or assert a disk edit.
//
// A `do` statement is the subject because dispatchNode has no case for
// KindDoStatement, so it prints verbatim and spans several lines. If it gains
// a printer this case needs another unhandled kind, not deletion: what it pins
// is the hazard, not the statement.
//
//  1. Parse a call whose callback body contains a multi-line `do`
//     statement (no per-node printer, spans several source lines).
//  2. Dispatch the CallExpression through PrintNode.
//  3. Assert the returned `covered` flag is false.
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must mark the enclosing callback call uncovered when its do/while subtree is multiline verbatim.
// @evidence contracts/testing.md#independent-expectations The independent source has interior do/while lines outside structured dispatcher coverage; reindenting only surrounding frames would freeze those columns.
// @evidence contracts/testing.md#distinguishing-cases An unsupported multiline statement contrasts with covered nested callbacks and single-line unknown-kind verbatim.
// @evidence contracts/testing.md#execution-ownership TestDispatchReportsUncoveredForMultilineVerbatimSubtree is a plain top-level Go unit test, selectable with go test -run, that calls PrintNode directly on a parsed call whose callback body holds a multi-line do-while statement inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchReportsUncoveredForMultilineVerbatimSubtree(t *testing.T) {
  file := parseTS(t, "run(() => {\n  do {\n    a();\n  } while (ready);\n});\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  _, covered := PrintNode(ctx, node)
  if covered {
    t.Fatalf("subtree with a multi-line verbatim statement must be uncovered")
  }
}
