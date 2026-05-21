package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchCallHugsLastCallbackArgument verifies a call whose last
// argument is an arrow function keeps that callback hugging the parens
// instead of exploding the whole argument list onto separate lines.
//
// This pins the last-argument-hugging shape (printListHuggingLast).
// Without it, the multi-line callback body forces the enclosing
// argument-list Group into broken mode, so the leading arguments each
// land on their own indented line — the opposite of what Prettier does
// for `foo(name, () => { … })`. The regression makes short, readable
// callback calls balloon vertically for no reason.
//
//  1. Parse `register(name, () => { handle(); });`.
//  2. Dispatch the CallExpression through PrintNode under the default
//     80-column budget.
//  3. Assert `register(name, () => {` stays on one line — the callback
//     hugs the parens and `name` is not pushed onto its own line.
func TestDispatchCallHugsLastCallbackArgument(t *testing.T) {
  file := parseTS(t, "register(name, () => { handle(); });\n")
  node := firstNodeOfKind(t, file, shimast.KindCallExpression)
  ctx := NewPrintContext(file, DefaultPrintOptions())
  doc, covered := PrintNode(ctx, node)
  if !covered {
    t.Fatalf("call with plain callback argument should be covered")
  }
  got := Print(doc, ctx.Opts)
  want := "register(name, () => {\n  handle();\n})"
  if got != want {
    t.Fatalf("hugged callback mismatch:\nwant %q\ngot  %q", want, got)
  }
}
