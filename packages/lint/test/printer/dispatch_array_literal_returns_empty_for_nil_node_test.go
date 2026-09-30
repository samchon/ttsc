package linthost

import (
  "testing"
)

// TestDispatchArrayLiteralReturnsEmptyForNilNode verifies the nil-node
// guard in printArrayLiteral returns an empty Doc without panicking.
//
// Symmetric partner of the object-literal nil-node test. The guard
// protects direct callers who might supply a nil pointer; the
// coverage gap is real even though the dispatcher always hands non-nil
// nodes to this printer.
//
// 1. Construct a PrintContext from a trivial parsed source.
// 2. Call printArrayLiteral with a nil node pointer.
// 3. Assert the rendered output is the empty string.
//
// @evidence contracts/testing.md#behavioral-verification printArrayLiteral must render no expression for a nil node.
// @evidence contracts/testing.md#independent-expectations An absent AST node contributes no source bytes under the layout identity contract.
// @evidence contracts/testing.md#distinguishing-cases The absent-node boundary complements intact flat/broken arrays and malformed public Elements lists.
// @evidence contracts/testing.md#execution-ownership TestDispatchArrayLiteralReturnsEmptyForNilNode is a selected public Go printer unit under TestSelectedLintUnits. The case calls its owning dispatcher or node printer on a local parsed or factory AST fixture in the same Go process, without installation, native product builds or product-host execution.
func TestDispatchArrayLiteralReturnsEmptyForNilNode(t *testing.T) {
  file := parseTS(t, "const x = 1;\n")
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, _ := printArrayLiteral(ctx, nil)
  got := Print(doc, ctx.Opts)
  if got != "" {
    t.Fatalf("nil-node array literal: want empty string, got %q", got)
  }
}
