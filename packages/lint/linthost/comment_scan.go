// Shared parser-aware comment enumeration for every rule or pass that needs
// exact comment byte ranges (inline directives, ban-ts-comment, and switch
// default markers).
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"

  "github.com/samchon/ttsc/packages/lint/rule/astutil"
)

// commentToken is one comment's kind and byte range.
//
// The enumeration itself is public API: a contributor rule that needs exact
// comment ranges must not have to re-derive which slash-shaped bytes are
// trivia, so it lives beside the other helpers `astutil` exposes for that
// reason. These aliases keep the host's own call sites reading as they did.
type commentToken = astutil.CommentToken

// forEachCommentToken visits every real comment in `file` in source order.
func forEachCommentToken(file *shimast.SourceFile, visit func(kind shimast.Kind, pos, end int)) {
  astutil.ForEachComment(file, visit)
}

// scanCommentGap scans one parser-classified non-token gap.
func scanCommentGap(scanner *shimscanner.Scanner, text string, from, to int, visit func(kind shimast.Kind, pos, end int)) {
  astutil.ScanCommentGap(scanner, text, from, to, visit)
}
