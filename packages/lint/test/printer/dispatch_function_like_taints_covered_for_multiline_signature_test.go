package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchFunctionLikeTaintsCoveredForMultilineSignature verifies that
// printFunctionLike returns covered==false when the verbatim prefix between
// the function header and the body contains a newline.
//
// The prefix (everything from the function start up to the body's first byte)
// is emitted verbatim because it almost never contains a newline. When it
// does — a multi-line parameter list, a long return-type annotation — that
// verbatim slice freezes its interior columns. Any reflow of the body would
// then produce inconsistently indented output, so printFunctionLike taints
// covered to false. The formatPrintWidth rule checks this flag and abstains
// rather than emitting a half-reflowed edit.
//
//  1. Parse an arrow function whose parameter list spans several lines (the `=>`
//     is on a separate line from the opening paren).
//  2. Dispatch the ArrowFunction through PrintNode.
//  3. Assert covered is false, signalling that the rule must not reflow this
//     node.
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must report an arrow with a multiline signature uncovered even though its return body could be reflowed.
// @evidence contracts/testing.md#independent-expectations The independently authored parameter lines remain verbatim, so reindenting the body alone would leave frozen signature columns.
// @evidence contracts/testing.md#distinguishing-cases A multiline prefix contrasts with the covered single-line arrow signature; this case observes coverage only.
// @evidence contracts/testing.md#execution-ownership TestDispatchFunctionLikeTaintsCoveredForMultilineSignature is a plain top-level Go unit test, selectable with go test -run, that calls PrintNode directly on a parsed arrow function whose parameter list spans several lines inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchFunctionLikeTaintsCoveredForMultilineSignature(t *testing.T) {
  src := "const f = (\n  a: string,\n  b: number\n) => { return a; };\n"
  file := parseTS(t, src)
  node := firstNodeOfKind(t, file, shimast.KindArrowFunction)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  _, covered := PrintNode(ctx, node)
  if covered {
    t.Fatalf("arrow with multi-line signature prefix must be covered=false, got true")
  }
}
