package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestDispatchCallHugsLastCallbackArgument verifies a call whose last
// argument is a block-bodied arrow function keeps that callback hugging
// the parens when the opening line fits, rather than exploding the list.
//
// This pins the direct last-argument-hugging shape (printListHuggingLast):
// the multiline callback body does not put name on a separate line.
// Header overflow and other arrow body shapes have separate layout
// decisions. No format command or independent Prettier process runs here.
//
//  1. Parse `register(name, () => { handle(); });`.
//  2. Dispatch the CallExpression through PrintNode under the default
//     80-column budget.
//  3. Assert `register(name, () => {` stays on one line — the callback
//     hugs the parens and `name` is not pushed onto its own line.
//
// @evidence contracts/testing.md#behavioral-verification PrintNode must retain register(name, followed immediately by its block callback, reindent the body and report coverage.
// @evidence contracts/testing.md#independent-expectations The literal result preserves name, handle() and the arrow signature while expressing the documented last-callback hugging layout.
// @evidence contracts/testing.md#distinguishing-cases A fitting call header with a final callback complements header-overflow explosion and expression-bodied callbacks.
// @evidence contracts/testing.md#execution-ownership TestDispatchCallHugsLastCallbackArgument is a plain top-level Go unit test, selectable with go test -run, that calls PrintNode directly on a parsed call with an identifier and a block callback at the default width inside the test process; it installs no consumer, builds no native artifact and starts no product host.
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
