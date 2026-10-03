package ast_test

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNodeTextJoinsMultiHopQualifiedName verifies NodeText joins a
// multi-hop QualifiedName as "A.B.C".
//
// QualifiedName.Left can itself be qualified. The three distinct components
// distinguish a full-chain join from dropping or reversing earlier names.
// A deeper repeated-component chain checks complete output without asserting
// timing, allocation counts or an implementation-specific traversal strategy.
//
// 1. Construct A.B then ((A.B).C) via NewQualifiedName.
// 2. Call NodeText on the outer node.
// 3. Assert the result is "A.B.C".
// 4. Build 2,000 X components followed by Tail and compare the complete text
//    against the independent repeated literal spelling.
//
// @evidence contracts/testing.md#behavioral-verification NodeText joins nested factory-built qualified names into A.B.C and preserves every component of a 2,001-name chain.
// @evidence contracts/testing.md#independent-expectations Literal A.B.C and 2,000 repetitions of X. followed by Tail specify source spelling without using NodeText as an oracle.
// @evidence contracts/testing.md#distinguishing-cases Distinct A/B/C names expose reversed order or a lost prefix; the deeper chain exposes truncated ancestry. Empty-component controls are owned by TestNodeTextSkipsEmptyQualifiedLeft, and this case does not measure complexity.
// @evidence contracts/testing.md#execution-ownership The case calls the shim on actual factory nodes in the existing Go shim unit process; no consumer compiler or native host is run.
func TestNodeTextJoinsMultiHopQualifiedName(t *testing.T) {
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  a := factory.NewIdentifier("A")
  b := factory.NewIdentifier("B")
  c := factory.NewIdentifier("C")
  ab := factory.NewQualifiedName(a, b)
  abc := factory.NewQualifiedName(ab, c)
  if got := shimast.NodeText(abc); got != "A.B.C" {
    t.Fatalf("NodeText(A.B.C) = %q, want %q", got, "A.B.C")
  }

  chain := factory.NewIdentifier("X")
  for i := 1; i < 2000; i++ {
    chain = factory.NewQualifiedName(chain, factory.NewIdentifier("X"))
  }
  chain = factory.NewQualifiedName(chain, factory.NewIdentifier("Tail"))
  if got, want := shimast.NodeText(chain), strings.Repeat("X.", 2000)+"Tail"; got != want {
    t.Fatalf("deep qualified spelling = %q, want %q", got, want)
  }
}
