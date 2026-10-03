package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchBlockKeepsCoveredForSingleLineStatements verifies the
// block printer reports `covered == true` for two comment-free calls,
// each confined to a single source line. Each expression statement's
// call is printed structurally, with a verbatim callee slice.
//
// These single-line callee slices retain no interior indentation to
// strand during reflow. The direct printer must retain both calls and
// their order while indenting them. This does not assert coverage for
// every single-line statement: an argument-gap comment can make a call
// uncovered, and the formatPrintWidth rule is not exercised here.
//
//  1. Parse a block whose two statements (`a();`, `b();`) each occupy
//     one line.
//  2. Dispatch the Block through PrintNode.
//  3. Assert `covered` is true and the statements render one per line.
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must retain a() then b() in a consistently indented block and report it fully covered.
// @evidence contracts/testing.md#independent-expectations The authored block literal preserves both calls, statement separators and order with two-space indentation.
// @evidence contracts/testing.md#distinguishing-cases Plain nonempty statements complement empty blocks and inter-statement comments that must prevent coverage.
// @evidence contracts/testing.md#execution-ownership TestDispatchBlockKeepsCoveredForSingleLineStatements is a plain top-level Go unit test, selectable with go test -run, that calls PrintNode directly on a parsed function body block of two single-line call statements inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestDispatchBlockKeepsCoveredForSingleLineStatements(t *testing.T) {
  file := parseTS(t, "function f() {\n  a();\n  b();\n}\n")
  node := firstNodeOfKind(t, file, shimast.KindBlock)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := PrintNode(ctx, node)
  if !covered {
    t.Fatalf("block of single-line statements should be covered")
  }
  got := Print(doc, ctx.Opts)
  want := "{\n  a();\n  b();\n}"
  if got != want {
    t.Fatalf("block render mismatch:\nwant %q\ngot  %q", want, got)
  }
}
