package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBlockHasNonStatementCommentReturnsFalseForOutOfRange verifies that
// blockHasNonStatementComment returns false when the node's End() position
// exceeds the length of the context's Source string.
//
// The guard `start < 0 || end < start || end > len(ctx.Source)` prevents
// the comment-scan loop from reading past the source buffer. The reachable
// form of this guard: a block node whose Pos() is 0 (safe for SkipTrivia)
// but whose End() is larger than a short replacement Source. This pattern
// arises when a node is paired with a context whose Source field was trimmed
// to a prefix of the original (e.g. for a partial reparse). Returning false
// is safe: the block cannot be inspected for comments, so the printer
// conservatively assumes no stray comment is present.
//
//  1. Parse a block `{ /* c */ }` that starts at position 0 in the source.
//  2. Construct a PrintContext whose Source is the 9-byte prefix
//     "{ /* c */" (shorter than the block End(), yet containing a comment opener).
//  3. Call blockHasNonStatementComment with the mismatched context.
//  4. Assert the function returns false, then assert it returns true when the
//     context carries the full source (control).
//
// @evidence contracts/testing.md#behavioral-verification blockHasNonStatementComment must return false when the parsed block range extends beyond the supplied source.
// @evidence contracts/testing.md#independent-expectations The literal 9-byte context source "{ /* c */" cannot contain the complete 11-byte parsed block, yet it holds a comment opener, so a scan beyond the range guard would answer true; the range-safety contract prohibits scanning outside the block.
// @evidence contracts/testing.md#distinguishing-cases The truncated context (false) is contrasted with the full-source control on the same block (true, comment reported); inter-statement comments in covered blocks are owned by the uncovered-block dispatch cases.
// @evidence contracts/testing.md#execution-ownership TestBlockHasNonStatementCommentReturnsFalseForOutOfRange is a plain top-level Go unit test, selectable with go test -run, that calls blockHasNonStatementComment directly on a parsed block paired with a truncated PrintContext source inside the test process; it installs no consumer, builds no native artifact and starts no product host.
func TestBlockHasNonStatementCommentReturnsFalseForOutOfRange(t *testing.T) {
  // Top-level `{ /* c */ }` is a block statement starting at position 0 and
  // ending at 11. The truncated context source "{ /* c */" is 9 bytes long:
  // it still contains a complete comment opener, so an implementation without
  // the range guard would scan it and report true. SkipTrivia(src, 0) = 0, so
  // the guard fires on end(11) > len(src)(9).
  file := parseTS(t, "{ /* c */ }\n")
  block := firstNodeOfKind(t, file, shimast.KindBlock)

  shortCtx := &PrintContext{
    Source: "{ /* c */",
    Opts:   DefaultPrintOptions(),
  }

  got := blockHasNonStatementComment(shortCtx, block, nil)
  if got {
    t.Fatalf("blockHasNonStatementComment should return false for out-of-range node, got true")
  }

  // Control: with the full source the same block does report its comment, so
  // the false above comes from the range guard, not from a comment-free block.
  fullCtx := NewPrintContext(file, DefaultPrintOptions())
  if !blockHasNonStatementComment(fullCtx, block, nil) {
    t.Fatalf("blockHasNonStatementComment should report the comment when the source covers the block")
  }
}
