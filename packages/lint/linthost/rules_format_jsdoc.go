package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// formatJsdoc rewrites JSDoc blocks toward the prettier-plugin-jsdoc
// canonical shape. The MVP implementation handles tag-synonym
// normalization; future passes will fold in tag sorting, @param column
// alignment, and description wrapping under the same rule name so
// projects pick up new behaviors by upgrading rather than by enabling
// additional rules. The synonym table covers the same names
// prettier-plugin-jsdoc documents:
//
//   - @return        →  @returns
//   - @arg, @argument →  @param
//   - @desc          →  @description
//   - @virtual       →  @abstract
//   - @func, @method →  @function
//
// JSDoc tags only fire when the `@` is at the start of a JSDoc line —
// preceded by `*`, whitespace, or a newline. Inline `@foo` references in
// prose text are left alone. The rule scans source bytes directly inside
// `/** ... */` blocks; it deliberately avoids relying on the JSDoc AST
// because comment attachment is a moving target across TypeScript
// versions.
type formatJSDoc struct{}

// formatJSDocOptions mirrors `TtscLintRuleOptions.JSDoc`. The
// `tagSynonyms` map layers on top of the built-in synonym table so
// projects can add custom aliases without losing the defaults.
type formatJSDocOptions struct {
  TagSynonyms map[string]string `json:"tagSynonyms"`
  SortTags    bool              `json:"sortTags"`
}

func (formatJSDoc) Name() string   { return "format/jsdoc" }
func (formatJSDoc) IsFormat() bool { return true }
func (formatJSDoc) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

var jsdocTagSynonyms = map[string]string{
  "return":   "returns",
  "arg":      "param",
  "argument": "param",
  "desc":     "description",
  "virtual":  "abstract",
  "func":     "function",
  "method":   "function",
}

func (formatJSDoc) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil {
    return
  }
  var opts formatJSDocOptions
  _ = ctx.DecodeOptions(&opts)
  synonyms := jsdocTagSynonyms
  if len(opts.TagSynonyms) > 0 {
    synonyms = make(map[string]string, len(jsdocTagSynonyms)+len(opts.TagSynonyms))
    for k, v := range jsdocTagSynonyms {
      synonyms[k] = v
    }
    for k, v := range opts.TagSynonyms {
      // Reject empty canonicals or canonicals carrying non-identifier
      // bytes — the fixer would otherwise emit malformed JSDoc like
      // `@` or `@my tag`. Silently dropping the bad entry is the right
      // failure mode: the rule already runs on every file in a project
      // and a single typo'd entry should not poison every block.
      if v == "" || !isValidJSDocTagName(v) {
        continue
      }
      synonyms[k] = v
    }
  }
  src := ctx.File.Text()
  for _, block := range findJSDocBlocks(src) {
    rewriteJSDocTags(ctx, src, block, synonyms)
  }
  // `sortTags` is reserved for a follow-up that pulls in the
  // prettier-plugin-jsdoc canonical order. The flag is parsed today so
  // the type surface freezes, but the implementation lands in a future
  // pass — projects that opt in get a no-op until then.
  _ = opts.SortTags
}

// jsdocBlock captures one `/** ... */` block's byte span. `bodyStart`
// excludes the leading `/**`, `bodyEnd` excludes the trailing `*/`.
type jsdocBlock struct {
  start, end         int
  bodyStart, bodyEnd int
}

// findJSDocBlocks enumerates JSDoc blocks via the tsgo scanner so the
// rule operates on real `MultiLineCommentTrivia` ranges. A naive
// byte-level scan for `/**` would mistakenly match `/**` sequences that
// appear inside string literals or template literals (e.g.
// `const s = "/** @return */";`), corrupting user data when the rule
// rewrote the embedded "tag" bytes. Using the scanner guarantees that
// only real comments enter the rule.
func findJSDocBlocks(src string) []jsdocBlock {
  out := make([]jsdocBlock, 0)
  scanner := shimscanner.NewScanner()
  scanner.SetText(src)
  scanner.SetSkipTrivia(false)
  for {
    kind := scanner.Scan()
    if kind == shimast.KindEndOfFile {
      break
    }
    if kind != shimast.KindMultiLineCommentTrivia {
      continue
    }
    start := scanner.TokenStart()
    end := scanner.TokenEnd()
    if end-start < 5 {
      // Shorter than `/** */`, can't contain tags.
      continue
    }
    if !(src[start] == '/' && src[start+1] == '*' && src[start+2] == '*') {
      continue
    }
    // Skip `/**/` — an empty doc block has no tags to rewrite.
    if end-start == 4 && src[start+3] == '/' {
      continue
    }
    out = append(out, jsdocBlock{
      start:     start,
      end:       end,
      bodyStart: start + 3,
      bodyEnd:   end - 2,
    })
  }
  return out
}

// rewriteJSDocTags scans one JSDoc block and emits a fix for each tag that has
// a canonical synonym. Tags preceded by a byte other than `*`, whitespace, or a
// newline are treated as inline `@foo` references (not top-level tags) and are
// left alone. Tags inside `@example` bodies are also skipped.
func rewriteJSDocTags(ctx *Context, src string, block jsdocBlock, synonyms map[string]string) {
  for i := block.bodyStart; i < block.bodyEnd; i++ {
    if src[i] != '@' {
      continue
    }
    if i > 0 {
      prev := src[i-1]
      if prev != ' ' && prev != '\t' && prev != '\n' && prev != '\r' && prev != '*' {
        continue
      }
    }
    tagStart := i + 1
    tagEnd := tagStart
    for tagEnd < block.bodyEnd && isJSDocTagByte(src[tagEnd]) {
      tagEnd++
    }
    if tagEnd == tagStart {
      continue
    }
    tag := src[tagStart:tagEnd]
    // `@example` opens a region of free-form sample code that may
    // include literal `@param` / `@return` etc. as part of the demo.
    // Rewriting those would corrupt the example. Fast-forward past
    // the example body to the next top-level tag.
    if tag == "example" {
      i = endOfJSDocExampleBody(src, block, tagEnd) - 1
      continue
    }
    canonical, ok := synonyms[tag]
    if !ok || canonical == tag {
      i = tagEnd - 1
      continue
    }
    ctx.ReportRangeFix(
      tagStart-1,
      tagEnd,
      "JSDoc tag should use the canonical name.",
      TextEdit{Pos: tagStart, End: tagEnd, Text: canonical},
    )
    i = tagEnd - 1
  }
}

// endOfJSDocExampleBody returns the byte offset of the next top-level
// tag (an `@` at line start, optionally after `*` and whitespace) at or
// after `start`, or `block.bodyEnd` when none exists. Used to skip the
// free-form body of an `@example` block when rewriting tag synonyms.
func endOfJSDocExampleBody(src string, block jsdocBlock, start int) int {
  for i := start; i < block.bodyEnd; i++ {
    if src[i] != '\n' {
      continue
    }
    // Find the first non-whitespace, non-`*` byte on the next line.
    j := i + 1
    for j < block.bodyEnd {
      c := src[j]
      if c == ' ' || c == '\t' || c == '\r' || c == '*' {
        j++
        continue
      }
      break
    }
    if j < block.bodyEnd && src[j] == '@' {
      return j
    }
  }
  return block.bodyEnd
}

// isJSDocTagByte reports whether `b` is an ASCII letter that may appear in a
// JSDoc tag name. Tags are purely alphabetic: digits, hyphens, and underscores
// terminate a tag name.
func isJSDocTagByte(b byte) bool {
  return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z')
}

// isValidJSDocTagName reports whether `name` is a non-empty sequence of
// JSDoc tag bytes (ASCII letters). The rule rejects user-supplied
// canonical names that fall outside this shape so the fix output stays
// well-formed.
func isValidJSDocTagName(name string) bool {
  if name == "" {
    return false
  }
  for i := 0; i < len(name); i++ {
    if !isJSDocTagByte(name[i]) {
      return false
    }
  }
  return true
}

func init() {
  Register(formatJSDoc{})
}
