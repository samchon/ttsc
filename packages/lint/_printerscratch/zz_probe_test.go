package linthost

import (
  "testing"
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

func TestProbe(t *testing.T) {
  src := "const x = 42;\n"
  file := parseTS(t, src)
  n := firstNodeOfKind(t, file, shimast.KindNumericLiteral)
  t.Logf("pos=%d end=%d", n.Pos(), n.End())
}
