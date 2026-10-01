// Shared parser-aware comment enumeration for every rule or pass that needs
// exact comment byte ranges (inline directives, ban-ts-comment, and switch
// default markers).
package linthost

import (
  "sort"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

type commentToken struct {
  kind shimast.Kind
  pos  int
  end  int
}

type sourceSpan struct {
  pos int
  end int
}

// forEachCommentToken visits every real comment in `file` in source order.
//
// TypeScript's parser, rather than a context-free scanner, owns the lexical
// goal for regular expressions, templates, and JSX. The parsed AST retains
// those context-sensitive tokens as exact spans. We treat those spans as
// opaque and scan only the gaps between them, where slash-shaped bytes are
// ordinary JavaScript trivia or punctuation. This preserves the scanner's
// complete comment and line-terminator behavior without guessing whether a
// slash is division, manually tracking template braces, or special-casing JSX
// strings. Exact ranges are deduplicated before the callback runs because a
// recovery AST can expose overlapping token nodes for malformed source.
func forEachCommentToken(file *shimast.SourceFile, visit func(kind shimast.Kind, pos, end int)) {
  if file == nil || visit == nil {
    return
  }
  text := file.Text()
  opaque := parserOpaqueTokenSpans(file)
  comments := make([]commentToken, 0)
  seen := make(map[sourceSpan]struct{})
  gapScanner := shimscanner.NewScanner()
  collect := func(kind shimast.Kind, pos, end int) {
    if pos < 0 || end <= pos || end > len(text) {
      return
    }
    span := sourceSpan{pos: pos, end: end}
    if _, ok := seen[span]; ok {
      return
    }
    seen[span] = struct{}{}
    comments = append(comments, commentToken{kind: kind, pos: pos, end: end})
  }

  cursor := 0
  for _, span := range opaque {
    if cursor < span.pos {
      scanCommentGap(gapScanner, text, cursor, span.pos, collect)
    }
    if span.end > cursor {
      cursor = span.end
    }
  }
  if cursor < len(text) {
    scanCommentGap(gapScanner, text, cursor, len(text), collect)
  }

  sort.Slice(comments, func(i, j int) bool {
    if comments[i].pos != comments[j].pos {
      return comments[i].pos < comments[j].pos
    }
    return comments[i].end < comments[j].end
  })
  for _, comment := range comments {
    visit(comment.kind, comment.pos, comment.end)
  }
}

// parserOpaqueTokenSpans returns merged source ranges for the parser-owned
// tokens whose contents a context-free scanner cannot classify: strings,
// regex literals, template heads/middles/tails, and JSX text. Numeric literals,
// identifiers, keywords, and punctuation remain in the scanned gaps because
// they cannot contain comment-shaped source bytes; keeping them there avoids a
// scanner reset for every ordinary token.
func parserOpaqueTokenSpans(file *shimast.SourceFile) []sourceSpan {
  spans := make([]sourceSpan, 0)
  var walk func(*shimast.Node)
  walk = func(node *shimast.Node) {
    if node == nil {
      return
    }
    if parserOpaqueTokenKind(node.Kind) {
      pos := shimscanner.GetTokenPosOfNode(node, file, false /*includeJSDoc*/)
      if pos >= 0 && node.End() > pos && node.End() <= len(file.Text()) {
        spans = append(spans, sourceSpan{pos: pos, end: node.End()})
      }
      return
    }
    node.ForEachChild(func(child *shimast.Node) bool {
      walk(child)
      return false
    })
  }
  walk(file.AsNode())
  sort.Slice(spans, func(i, j int) bool {
    if spans[i].pos != spans[j].pos {
      return spans[i].pos < spans[j].pos
    }
    return spans[i].end < spans[j].end
  })
  if len(spans) < 2 {
    return spans
  }
  merged := spans[:1]
  for _, span := range spans[1:] {
    last := &merged[len(merged)-1]
    if span.pos <= last.end {
      if span.end > last.end {
        last.end = span.end
      }
      continue
    }
    merged = append(merged, span)
  }
  return merged
}

func parserOpaqueTokenKind(kind shimast.Kind) bool {
  return kind >= shimast.KindStringLiteral && kind <= shimast.KindLastLiteralToken ||
    kind >= shimast.KindFirstTemplateToken && kind <= shimast.KindLastTemplateToken
}

// scanCommentGap scans one parser-classified non-token gap. Context-sensitive
// token bodies never enter this function, so every comment trivia token it
// returns is a real source comment. Scanning the isolated gap also preserves
// CRLF and Unicode line-terminator behavior without range arithmetic in a
// second comment parser.
func scanCommentGap(scanner *shimscanner.Scanner, text string, from, to int, visit func(kind shimast.Kind, pos, end int)) {
  if scanner == nil || from < 0 || to <= from || to > len(text) {
    return
  }
  scanner.SetText(text[from:to])
  scanner.SetSkipTrivia(false)
  for {
    kind := scanner.Scan()
    switch kind {
    case shimast.KindEndOfFile:
      return
    case shimast.KindSingleLineCommentTrivia, shimast.KindMultiLineCommentTrivia:
      visit(kind, from+scanner.TokenStart(), from+scanner.TokenEnd())
    }
  }
}
