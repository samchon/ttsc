// defaultCase: a `switch` statement that omits the `default` clause
// silently drops every discriminant value not matched by an explicit
// `case` label. The rule wants the catch-all path written out — unless the
// omission is deliberately marked by a trailing `// no default` comment.
//
// Behavior mirrors ESLint's `default-case`:
//
//   - An empty switch (`switch (x) {}`, zero clauses) is skipped: an empty
//     case block has no clause to attach the marker comment to, so upstream
//     bails with `if (!node.cases.length) return;`.
//   - A `default` clause anywhere in the block satisfies the rule.
//   - Otherwise the LAST comment trailing the final clause (between its end
//     and the case block's `}`) is tested against `commentPattern`. When the
//     comment's trimmed text matches, the omission is intentional and the
//     switch is left alone; otherwise the rule reports on the `switch`
//     keyword so the diagnostic lands at the head of the statement.
//
// `commentPattern` replaces the default marker pattern `/^no default$/i`
// (ESLint's DEFAULT_COMMENT_PATTERN). The trailing-comment scan reuses
// comment_scan.go's parser-aware gap scanner over the trivia-only region
// after the last clause.
// https://eslint.org/docs/latest/rules/default-case
package linthost

import (
  "regexp"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// defaultCaseDefaultCommentPattern is ESLint's DEFAULT_COMMENT_PATTERN
// (`/^no default$/iu`) in RE2: the trailing comment's trimmed text must be
// exactly `no default`, in any letter case.
var defaultCaseDefaultCommentPattern = regexp.MustCompile(`(?i)^no default$`)

// defaultCaseOptions mirrors the upstream rule's single-object schema.
type defaultCaseOptions struct {
  // CommentPattern replaces the default `no default` marker pattern when
  // non-empty. Upstream compiles it with the `u` flag and no `i`, so the
  // custom pattern is case-sensitive unless it opts in. An uncompilable
  // pattern falls back to the default marker (matching no-fallthrough) so a
  // config typo cannot silently turn every marked switch into a finding.
  CommentPattern string `json:"commentPattern"`
}

type defaultCase struct{ optionsRule }

func (defaultCase) Name() string           { return "default-case" }
func (defaultCase) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSwitchStatement} }
func (defaultCase) Check(ctx *Context, node *shimast.Node) {
  sw := node.AsSwitchStatement()
  if sw == nil || sw.CaseBlock == nil || ctx.File == nil {
    return
  }
  block := sw.CaseBlock.AsCaseBlock()
  if block == nil || block.Clauses == nil {
    return
  }
  clauses := block.Clauses.Nodes
  // Empty switch: upstream skips it because an empty case block offers no
  // clause to read the marker comment from.
  if len(clauses) == 0 {
    return
  }
  for _, clause := range clauses {
    if clause != nil && clause.Kind == shimast.KindDefaultClause {
      return
    }
  }

  var opts defaultCaseOptions
  ctx.DecodeOptions(&opts)
  pattern := defaultCaseDefaultCommentPattern
  if opts.CommentPattern != "" {
    if custom, err := compileUserPattern(opts.CommentPattern); err == nil {
      pattern = custom
    }
  }

  // ESLint's sourceCode.getCommentsAfter(lastCase).at(-1): the LAST comment
  // between the final clause and the case block's closing brace marks the
  // omission intentional when its trimmed text matches the pattern. A
  // trailing non-marker comment after a `// no default` therefore invalidates
  // the marker.
  if lastClause := clauses[len(clauses)-1]; lastClause != nil {
    text := ctx.File.Text()
    closeBrace := sw.CaseBlock.End() - 1 // exclusive End covers the `}` token
    if pos, end, ok := defaultCaseLastTrailingComment(text, lastClause.End(), closeBrace); ok &&
      pattern.MatchString(strings.TrimSpace(commentInnerText(text[pos:end]))) {
      return
    }
  }

  ctx.Report(node, "Expected a default case.")
}

// defaultCaseLastTrailingComment returns the source range of the LAST comment
// in the trivia region [from, to), reusing comment_scan.go's parser-aware gap
// scanner. The region between a switch's last clause and its closing brace is
// trivia-only by construction, so scanning the isolated gap is exact.
func defaultCaseLastTrailingComment(text string, from, to int) (pos, end int, ok bool) {
  if from < 0 || to > len(text) || from >= to {
    return 0, 0, false
  }
  scanCommentGap(shimscanner.NewScanner(), text, from, to, func(_ shimast.Kind, p, e int) {
    pos, end, ok = p, e, true
  })
  return pos, end, ok
}

func init() {
  Register(defaultCase{})
}
