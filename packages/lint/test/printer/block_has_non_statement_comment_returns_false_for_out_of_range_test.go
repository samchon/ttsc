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
//  1. Parse a block that starts at position 0 in the source.
//  2. Construct a PrintContext whose Source is a single character "{"
//     (shorter than the block's End()).
//  3. Call blockHasNonStatementComment with the mismatched context.
//  4. Assert the function returns false without panicking.
//
// @evidence contracts/testing.md#behavioral-verification blockHasNonStatementComment must return false when the parsed block range extends beyond the supplied source.
// @evidence contracts/testing.md#independent-expectations The literal one-character context source cannot contain the complete parsed block; the range-safety contract prohibits scanning outside it.
// @evidence contracts/testing.md#distinguishing-cases A valid AST with a shortened context exercises range mismatch; actual inter-statement comments are checked by the uncovered-block dispatch cases.
// @evidence contracts/testing.md#execution-ownership TestBlockHasNonStatementCommentReturnsFalseForOutOfRange is a selected public Go printer unit under TestSelectedLintUnits. It calls the owning operation on local Doc, source or AST fixtures in the shared Go test process, without consumer installation, native product builds or product-host execution.
func TestBlockHasNonStatementCommentReturnsFalseForOutOfRange(t *testing.T) {
  // Top-level `{ }` is a block statement starting at position 0.
  // SkipTrivia("{", 0) = 0 (safe); End() = 3 > len("{") = 1 → guard fires.
  file := parseTS(t, "{ }\n")
  block := firstNodeOfKind(t, file, shimast.KindBlock)

  // Source shorter than block.End() but long enough that SkipTrivia(src, 0) is safe.
  shortCtx := &PrintContext{
    Source: "{",
    Opts:   DefaultPrintOptions(),
  }

  got := blockHasNonStatementComment(shortCtx, block, nil)
  if got {
    t.Fatalf("blockHasNonStatementComment should return false for out-of-range node, got true")
  }
}
