package main

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// format/jsdoc rewrites JSDoc blocks toward the prettier-plugin-jsdoc
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

func (formatJSDoc) Name() string     { return "format/jsdoc" }
func (formatJSDoc) IsFormat() bool   { return true }
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

func findJSDocBlocks(src string) []jsdocBlock {
  out := make([]jsdocBlock, 0)
  for i := 0; i < len(src); i++ {
    if !(i+2 < len(src) && src[i] == '/' && src[i+1] == '*' && src[i+2] == '*') {
      continue
    }
    // Skip `/**/` — that's an empty block, no tags possible.
    if i+3 < len(src) && src[i+3] == '/' {
      i += 3
      continue
    }
    j := i + 3
    for j+1 < len(src) && !(src[j] == '*' && src[j+1] == '/') {
      j++
    }
    if j+1 >= len(src) {
      break
    }
    out = append(out, jsdocBlock{
      start:     i,
      end:       j + 2,
      bodyStart: i + 3,
      bodyEnd:   j,
    })
    i = j + 1
  }
  return out
}

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

func isJSDocTagByte(b byte) bool {
  return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z')
}

func init() {
  Register(formatJSDoc{})
}
