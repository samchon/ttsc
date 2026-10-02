// Package astutil exposes the AST/text helpers `@ttsc/lint` built-in rules
// already rely on, so third-party contributor rules can build autofixes
// without re-implementing trivia, keyword location, or token-range math.
//
// These helpers are deliberately byte-oriented to match the
// `rule.TextEdit` contract: positions returned from this package can be
// fed directly into a `TextEdit{Pos, End, Text}` literal.
//
// All functions are pure (no shared state) and safe to call from any
// goroutine — `*shimast.SourceFile` and `*shimast.Node` are read-only
// from the rule's perspective.
package astutil

import (
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// NodeText returns the source text under `node` with leading trivia
// (whitespace + comments) stripped AND trailing ASCII whitespace
// (` `, `\t`, `\r`, `\n`) trimmed. Mirrors `nodeText` in the built-in
// engine. Useful for rules that compare textual identity (the
// `no-self-assign` / `no-self-compare` shape) or that splice a
// sub-node's text into a fix string.
//
// The trailing trim is deliberate so callers using the returned text
// as the right-hand side of a `TextEdit{End: ...}` splice don't drag
// in a node's trailing newline. Callers that need the literal byte
// range without trimming should call `TokenRange` and read `file.Text()`
// directly.
//
// Returns "" when `file` or `node` is nil, or when the computed range
// falls outside the file, including malformed nodes supplied by callers.
//
// @evidence contracts/common.md#principled-implementation Compiler trivia skipping and ASCII trailing trimming preserve the documented source-text boundary; invalid node ranges yield an empty result.
// @evidence contracts/common.md#clear-and-simple-design One helper owns the text extraction used by contributor comparisons and edits.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Source extraction uses the supported compiler scanner rather than comment-pattern special cases.
// @evidence contracts/common.md#meaningful-documentation Native prose explains trimmed versus literal ranges and defensive results; paragraphs and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NodeText performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms Bounds checks are fixed work; compiler SkipTrivia scans l leading-trivia bytes and the fixed ASCII TrimRight scans t trailing bytes, giving O(1+l+t) boundary work without copying the selected source text. Trivia can extend beyond the node end before the post-scan range guard rejects it; delegation does not make scanning fixed-cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This pure extraction helper coordinates no requests or shared state. The caller owns source/node snapshot validity and reuse of extracted text; this operation introduces no cross-Program cache keyed only by mutable AST pointers or ranges.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned string is a view into the supplied source bytes, not an independent copy, so retaining it can retain the complete source allocation. The caller owns that retention and can copy when a separate lifetime is needed; this helper stores no historical results and acquires no native handle or task.
func NodeText(file *shimast.SourceFile, node *shimast.Node) string {
  if file == nil || node == nil {
    return ""
  }
  src := file.Text()
  end := node.End()
  if node.Pos() < 0 || node.Pos() > len(src) {
    return ""
  }
  pos := shimscanner.SkipTrivia(src, node.Pos())
  if pos < 0 || end > len(src) || pos >= end {
    return ""
  }
  return strings.TrimRight(src[pos:end], " \t\r\n")
}

// KeywordStart returns the source offset of a declaration keyword such as
// `var`, `let`, `const`, `module`, `namespace`, or `function` that lives
// in the declaration prefix of `node` (after leading trivia and modifiers).
// Names, type syntax, parameters and bodies end that prefix. Decorator
// expressions do not supply the declaration keyword. Returns -1 if not found.
// Comments, literal contents and identifier prefixes are not keyword tokens.
//
// Use this to anchor TextEdits that swap a leading keyword:
//
//  start := astutil.KeywordStart(file, node, "let")
//  if start >= 0 {
//    ctx.ReportFix(node, "use const",
//      rule.TextEdit{Pos: start, End: start + len("let"), Text: "const"})
//  }
//
// @evidence contracts/common.md#principled-implementation Parser header boundaries and token search locate the declaration keyword without mistaking nested bodies or parameter initializers for the declaration.
// @evidence contracts/common.md#clear-and-simple-design Node-based search shares the same token-location implementation as arbitrary-range search.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler tokens replace the guessed 32-byte prefix and raw substring workaround.
// @evidence contracts/common.md#meaningful-documentation Native prose explains modifier handling, token exclusions, missing results and an edit example; separated tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation KeywordStart scans source text positions and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms Header-bound selection inspects h declarations and parameters before constructing the scanner. A matching first token avoids opaque-span collection; otherwise a child walk visits a nodes, collects s opaque spans and sorts them in O(s log s), followed by forward lexical search. Delegated trivia/token decoding costs depend on bytes consumed, not just token count; the grammar boundary excludes body traversal while preserving modifier and decorator distinctions.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This pure lookup helper coordinates no requests or shared memo. Source/node identity and positions belong to the caller snapshot; scanner state is fresh for the requested grammar boundary, and any caller reuse must remain valid for that snapshot rather than AST pointer equality across Programs.
// @evidence contracts/performance.md#bound-retention-and-release-resources The call owns a temporary scanner, up to s collected spans and recursive walk depth. The scanner borrows the source and may allocate decoded token values or per-scan numeric caches proportional to scanned data; none survives through the returned integer. Inputs remain caller-owned, and this helper retains no history, native handle or running task.
func KeywordStart(file *shimast.SourceFile, node *shimast.Node, keyword string) int {
  if file == nil || node == nil || keyword == "" {
    return -1
  }
  pos, end := node.Pos(), node.End()
  if pos < 0 || pos >= end || end > len(file.Text()) {
    return -1
  }
  limit := func(child *shimast.Node) {
    if child != nil && child.Pos() >= pos && child.Pos() < end {
      end = child.Pos()
    }
  }
  limit(node.Name())
  limit(node.Body())
  declarations := node
  if node.Kind == shimast.KindVariableStatement {
    if statement := node.AsVariableStatement(); statement != nil {
      declarations = statement.DeclarationList
    }
  }
  if declarations != nil && declarations.Kind == shimast.KindVariableDeclarationList {
    if list := declarations.AsVariableDeclarationList(); list != nil && list.Declarations != nil {
      for _, declaration := range list.Declarations.Nodes {
        limit(declaration)
      }
    }
  }
  if function := node.FunctionLikeData(); function != nil {
    limit(function.Type)
    if function.TypeParameters != nil {
      for _, parameter := range function.TypeParameters.Nodes {
        limit(parameter)
      }
    }
    if function.Parameters != nil {
      for _, parameter := range function.Parameters.Nodes {
        limit(parameter)
      }
    }
  }
  scan := shimscanner.GetScannerForSourceFile(file, pos)
  if keywordMatches(scan, pos, end, keyword) {
    return scan.TokenStart()
  }
  return searchKeyword(scan, pos, end, keyword, opaqueSpans(file, node, end, true))
}

// FindKeyword scans `[pos, end)` for a keyword token whose lexeme is
// `keyword` and returns its first-byte offset, or -1 if not found.
// Differs from KeywordStart in that it works on an arbitrary byte range
// instead of a declaration header. Scanning starts at the file beginning to
// preserve lexical context, but matches must lie inside the range. Use this
// for fixes that splice text after `import` or before `from`.
//
// The compiler scanner handles Unicode identifier boundaries and trivia.
// Parser-classified strings, regex literals, template text and JSX text are
// excluded so a matching word inside literal content is never returned.
// The entire keyword token must lie within the requested range.
//
// @evidence contracts/common.md#principled-implementation Parser opaque spans prevent context-sensitive literal contents from entering lexical search; the compiler scanner then recognizes complete keyword tokens and their original byte ranges.
// @evidence contracts/common.md#clear-and-simple-design One search implementation owns literal exclusion, lexical matching and range bounds for public and host callers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Language tokens replace ASCII flank guesses and raw text matches, without fixture-specific exceptions or foreign scanner mutation.
// @evidence contracts/common.md#meaningful-documentation Native prose states Unicode, literal and complete-range behavior; paragraphs and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation FindKeyword performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms The parser child walk visits a nodes, pruning descent at the requested end or an opaque literal, then sorts s spans in O(s log s). Forward scanning begins at file byte zero to preserve lexical context and can consume a complete boundary token before rejecting it; token/trivia decoding is driven by scanned bytes and values. This may read the prefix before pos, and temporary span storage grows with s; no fixed-cost claim follows from delegation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This pure range lookup owns no request coordinator or shared memo. The caller owns source snapshot identity, byte-range validity and any reuse across repeated queries; a fresh scanner preserves lexical context for this range instead of reusing a position under a changed Program.
// @evidence contracts/performance.md#bound-retention-and-release-resources The call owns a temporary scanner, s opaque-span slots and recursive walk stack. Scanner token values and numeric caches can allocate according to scanned data while borrowing the source; only one integer leaves the function, so those temporary owners become unreachable on return. No cross-call history, native handle or task is retained.
func FindKeyword(file *shimast.SourceFile, pos, end int, keyword string) int {
  if file == nil || keyword == "" {
    return -1
  }
  src := file.Text()
  if pos < 0 {
    pos = 0
  }
  if end > len(src) {
    end = len(src)
  }
  if pos >= end {
    return -1
  }
  scan := shimscanner.GetScannerForSourceFile(file, 0)
  return searchKeyword(scan, pos, end, keyword, opaqueSpans(file, file.AsNode(), end, false))
}

// keywordMatches accepts complete language keyword tokens within the range.
func keywordMatches(scan *shimscanner.Scanner, pos, end int, keyword string) bool {
  kind := scan.Token()
  return scan.TokenStart() >= pos && scan.TokenEnd() <= end &&
    kind >= shimast.KindFirstKeyword && kind <= shimast.KindLastKeyword &&
    scan.TokenText() == keyword
}

// searchKeyword skips parser-classified opaque text before lexical matching.
// Node callers start at their grammar boundary; arbitrary ranges start at the
// source beginning so a range inside a string or comment cannot create tokens.
func searchKeyword(scan *shimscanner.Scanner, pos, end int, keyword string, spans []opaqueSpan) int {
  spanIndex := 0
  for scan.Token() != shimast.KindEndOfFile && scan.TokenStart() < end {
    start := scan.TokenStart()
    for spanIndex < len(spans) && spans[spanIndex].end <= start {
      spanIndex++
    }
    if spanIndex < len(spans) && spans[spanIndex].pos <= start {
      scan.ResetTokenState(spans[spanIndex].end)
      scan.Scan()
      continue
    }
    if keywordMatches(scan, pos, end, keyword) {
      return start
    }
    scan.Scan()
  }
  return -1
}

// TokenRange returns the node's `[pos, end)` range with leading trivia
// stripped from the start and its original End preserved. It covers the
// complete node, not only its first lexical token. Useful for rules that
// want their diagnostic and fix range aligned to the token rather than
// the surrounding whitespace.
//
// Returns `(-1, -1)` when `file` or `node` is nil or when the computed
// range is malformed.
//
// @evidence contracts/common.md#principled-implementation Compiler trivia skipping produces the token start while node End remains the half-open bound; malformed ranges return the documented sentinel pair.
// @evidence contracts/common.md#clear-and-simple-design One range helper separates untrimmed byte coordinates from NodeText's trailing trim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Range extraction uses supported compiler trivia semantics without guessed whitespace or consumer-specific offsets.
// @evidence contracts/common.md#meaningful-documentation Native prose describes byte-range alignment and invalid sentinels; paragraphs and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation TokenRange performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms Bounds checks and two coordinate returns are fixed work; compiler SkipTrivia scans l leading-trivia bytes, giving O(1+l) boundary work without copying source text or traversing the node body. Malformed trivia can reach beyond the node end before the post-scan guard rejects the range.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This pure coordinate helper coordinates no requests or shared state. The caller owns the source/node snapshot whose positions establish validity and any reuse of these coordinates; this operation adds no cross-Program memo based on AST pointers alone.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only two integer coordinates leave this function; they retain no source string, AST pointer or allocation. The caller owns the input Program lifetime, and this helper stores no historical results or acquires any native handle or task.
func TokenRange(file *shimast.SourceFile, node *shimast.Node) (int, int) {
  if file == nil || node == nil {
    return -1, -1
  }
  src := file.Text()
  if node.Pos() < 0 || node.Pos() > len(src) {
    return -1, -1
  }
  pos := shimscanner.SkipTrivia(src, node.Pos())
  end := node.End()
  if pos < 0 || pos > len(src) || end < pos || end > len(src) {
    return -1, -1
  }
  return pos, end
}

type opaqueSpan struct {
  pos int
  end int
}

// opaqueSpans uses parser classification because scanning alone cannot
// distinguish regex bodies, template continuations and JSX text from code.
func opaqueSpans(file *shimast.SourceFile, root *shimast.Node, end int, declarationPrefix bool) []opaqueSpan {
  spans := make([]opaqueSpan, 0)
  var walk func(*shimast.Node)
  walk = func(node *shimast.Node) {
    if node == nil || node.Pos() >= end {
      return
    }
    kind := node.Kind
    if kind >= shimast.KindStringLiteral && kind <= shimast.KindLastLiteralToken ||
      kind >= shimast.KindFirstTemplateToken && kind <= shimast.KindLastTemplateToken ||
      kind == shimast.KindJsxText || kind == shimast.KindJsxTextAllWhiteSpaces ||
      declarationPrefix && kind == shimast.KindDecorator {
      start := shimscanner.GetTokenPosOfNode(node, file, false)
      if start >= 0 && node.End() > start && node.End() <= len(file.Text()) {
        spans = append(spans, opaqueSpan{pos: start, end: node.End()})
      }
      return
    }
    node.ForEachChild(func(child *shimast.Node) bool {
      walk(child)
      return false
    })
  }
  walk(root)
  sort.Slice(spans, func(i, j int) bool {
    if spans[i].pos != spans[j].pos {
      return spans[i].pos < spans[j].pos
    }
    return spans[i].end < spans[j].end
  })
  return spans
}
