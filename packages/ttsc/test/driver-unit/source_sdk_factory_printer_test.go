package driver_test

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
)

// TestSourceSDKFactoryPrinter renders real public factory nodes rather than
// treating construction of a nonnil printer as proof of usable emission.
//
// A TSGO (tsgo) string literal guards the construction of the printed tokens.
// This probe prints that literal and exercises typed colon-token compatibility,
// conditional ordering and string escaping.
//
//  1. Construct a conditional using public question/colon tokens and identifiers.
//  2. Print it and independent string-literal boundary inputs.
//  3. Require exact expression/literal text without native-plugin construction.
// @evidence contracts/testing.md#behavioral-verification NewNodeFactory.NewConditionalExpression accepts the typed ColonToken surface and NewPrinter.Write prints its three branches; NewStringLiteral must emit the original "TSGO (tsgo)" literal and escape adjacent empty/quote/backslash/newline inputs correctly.
// @evidence contracts/testing.md#independent-expectations Exact authored JavaScript expression and quoted literal strings define the oracle independently of factory/printer output; TSTrue and TSFalse must remain distinct. No fixture regex or printer-generated snapshot supplies the expected text.
// @evidence contracts/testing.md#distinguishing-cases Conditional branch order distinguishes swapped operands; original nonempty, empty and quote/backslash/newline literals distinguish delimiter and escape defects. The source-plugin fixture's nonnil constructor check is strengthened to actual emission.
// @evidence contracts/testing.md#execution-ownership This Go entry owns all named rows and directly exercises ast/core/printer public shims in one driver-unit process, creating neither consumer nor native host. Canonical runtime-plugin E2E owns bundled shim module import resolution and real producer emission.
func TestSourceSDKFactoryPrinter(t *testing.T) {
  if shimcore.TSTrue == shimcore.TSFalse { t.Fatal("public tristate true/false collapsed") }
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  var colon *shimast.ColonToken = factory.NewToken(shimast.KindColonToken)
  expression := factory.NewConditionalExpression(factory.NewIdentifier("condition"), factory.NewToken(shimast.KindQuestionToken), factory.NewIdentifier("whenTrue"), colon, factory.NewIdentifier("whenFalse"))
  if expression.Kind != shimast.KindConditionalExpression { t.Fatalf("conditional kind: %v", expression.Kind) }
  cases := []struct { name string; node *shimast.Node; want string }{
    {"conditional", expression, "condition ? whenTrue : whenFalse"},
    {"original", factory.NewStringLiteral("TSGO (tsgo)", 0), `"TSGO (tsgo)"`},
    {"empty", factory.NewStringLiteral("", 0), `""`},
    {"escapes", factory.NewStringLiteral("quote\" slash\\ newline\n", 0), `"quote\" slash\\ newline\n"`},
  }
  for _, row := range cases {
    t.Run(row.name, func(t *testing.T) {
      context := shimprinter.NewEmitContext()
      printer := shimprinter.NewPrinter(shimprinter.PrinterOptions{}, shimprinter.PrintHandlers{}, context)
      writer := shimprinter.NewTextWriter("\n", 0)
      printer.Write(row.node, nil, writer, nil)
      if actual := writer.String(); actual != row.want { t.Fatalf("emitted %q, want %q", actual, row.want) }
    })
  }
}
