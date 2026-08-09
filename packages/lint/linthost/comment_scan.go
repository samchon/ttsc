// Shared parser-aware comment enumeration for every rule or pass that needs
// exact comment byte ranges (inline directives, ban-ts-comment, and switch
// default markers).
package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule/astutil"
)

// forEachCommentToken visits every real comment in `file` in source order.
//
// The enumeration itself is public API: a contributor rule that needs exact
// comment ranges must not have to re-derive which slash-shaped bytes are
// trivia, so it lives beside the other helpers `astutil` exposes for that
// reason. This alias keeps the host's call sites reading as they did.
func forEachCommentToken(file *shimast.SourceFile, visit func(kind shimast.Kind, pos, end int)) {
  astutil.ForEachComment(file, visit)
}
