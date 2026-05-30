package linthost

import (
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// formatDeclarationHeader reflows the header of a class or interface
// declaration, its type-parameter list and `extends`/`implements`
// clauses up to the opening `{`, to match Prettier 3. The member body
// is never touched (members keep reflowing independently via
// format/print-width), so the rule edits only the byte range
// `[header start, '{']` and can never overlap a member edit.
//
// It reconstructs the header canonically and emits an edit only when the
// result differs from the source, so it both fixes a Prettier-2-style
// broken header and leaves an already-correct one alone (idempotent).
//
// Verified Prettier 3 shapes (printWidth W, the header overflows):
//
//   - Single heritage type, no type parameters -> kept inline (Prettier
//     never breaks a lone `extends X<Y>`), so the rule abstains.
//   - One clause with multiple types -> break before the keyword and keep
//     the types inline; explode them one-per-line only when that inline
//     line still overflows:
//     interface B
//     extends First, Second {
//   - Multiple clauses -> break before each keyword, types inline:
//     class C
//     extends Base
//     implements First, Second
//     {
//   - Opening brace placement -> Prettier moves `{` onto its own line only
//     for a class with a non-empty body; an interface and any empty body
//     keep it glued to the last header line (so `… implements X {}`).
//   - Type-parameter list overflow -> explode the `<...>` list (trailing
//     comma, `>` at the base indent), heritage inline after `>`:
//     interface D<
//     TKey extends string,
//     > extends Base<TKey> {
//     A single parameter whose `extends C = D` overflows breaks after `=`.
//
// Any combination the rule has not verified (e.g. type parameters AND a
// breaking heritage clause at once), a header carrying comments, or a
// type/parameter that is itself multi-line makes the rule ABSTAIN, so it
// never emits a header it cannot reproduce exactly.
type formatDeclarationHeader struct{}

type formatDeclarationHeaderOptions struct {
  PrintWidth *int    `json:"printWidth"`
  TabWidth   *int    `json:"tabWidth"`
  UseTabs    *bool   `json:"useTabs"`
  EndOfLine  *string `json:"endOfLine"`
}

func (formatDeclarationHeader) Name() string   { return "format/declaration-header" }
func (formatDeclarationHeader) IsFormat() bool { return true }

func (formatDeclarationHeader) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindClassDeclaration,
    shimast.KindInterfaceDeclaration,
  }
}

func (formatDeclarationHeader) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil || node == nil {
    return
  }
  typeParams, heritage, name := declarationHeaderParts(node)
  if name == nil {
    return
  }
  hasTypeParams := typeParams != nil && len(typeParams.Nodes) > 0
  hasHeritage := heritage != nil && len(heritage.Nodes) > 0
  if !hasTypeParams && !hasHeritage {
    return // nothing in the header to reflow
  }

  src := ctx.File.Text()
  nameEnd := name.End()
  if nameEnd <= 0 || nameEnd > len(src) {
    return
  }

  // The header line starts at the first non-whitespace byte of the line
  // holding the declaration name; decorators and modifiers on that line
  // are carried verbatim in the prefix.
  headerStart := lineFirstNonSpace(src, name.Pos())
  if headerStart < 0 {
    return
  }

  // Locate the `{` that opens the body, scanning from the end of the
  // last header element so a `{` inside a type-parameter default does
  // not fool the search.
  scanFrom := nameEnd
  if hasTypeParams {
    // A type-parameter NodeList ends at the last parameter, before the
    // closing `>`. Advance past that `>` so the body-brace search does
    // not stop on it (the heritage case is already past it via
    // heritage.End()).
    scanFrom = maxInt(scanFrom, typeParams.End())
    if gt := findCloseTokenAfter(src, typeParams.End(), '>'); gt >= 0 {
      scanFrom = maxInt(scanFrom, gt+1)
    }
  }
  if hasHeritage {
    scanFrom = maxInt(scanFrom, heritage.End())
  }
  bracePos := findCloseTokenAfter(src, scanFrom, '{')
  if bracePos < 0 {
    return
  }

  // Everything from the end of the verbatim prefix (the name) to the
  // brace is discarded and rebuilt element by element, so a comment
  // anywhere in that span would be lost, including one between the name
  // and `extends`, or between `extends` and its first type. Scan the whole
  // [nameEnd, brace) region and abstain on any comment.
  if containsComment(src[nameEnd:bracePos]) {
    return
  }

  layout := loadDeclarationHeaderLayout(ctx)
  // The prefix is the modifiers + keyword + name, which live between the
  // header line's first token and the name's end. Type parameters and
  // heritage are rebuilt separately, so anything after the name (incl.
  // newlines an already-broken header introduced) is not part of it.
  prefix := strings.TrimRight(src[headerStart:nameEnd], " \t")
  if strings.ContainsRune(prefix, '\n') {
    return // modifiers split across lines: abstain
  }

  // Gather verbatim element texts; abstain if any spans multiple lines.
  paramTexts, ok := nodeListTexts(src, typeParams)
  if !ok {
    return
  }
  clauses, ok := heritageClauseInfos(src, heritage)
  if !ok {
    return
  }

  base := src[lineStartOffset(src, headerStart):headerStart]
  startCol := visualWidth(base, layout.tabWidth)
  flat := prefix + flatTypeParams(paramTexts) + flatHeritage(clauses) + " {"
  region := src[headerStart : bracePos+1]

  // An empty body renders its closing `}` on the same line (`… {}`), so the
  // flat form is one column wider than the rebuilt region (which ends at the
  // `{`). Charge that column when deciding whether the header fits, or the
  // fit check is off by one against Prettier at the width boundary.
  isClass := node.Kind == shimast.KindClassDeclaration
  emptyBody := headerBodyIsEmpty(src, bracePos)
  flatExtra := 0
  if emptyBody {
    flatExtra = 1
  }

  var target string
  if startCol+visualWidth(flat, layout.tabWidth)+flatExtra <= layout.printWidth {
    target = flat
  } else if t, ok2 := singleGenericHeritageHeader(src, base, prefix, typeParams, heritage, layout); ok2 {
    // A lone heritage clause whose single generic type has two or more type
    // arguments breaks the argument list, not the clause (`extends Omit<\n …\n>`).
    target = t
  } else {
    // Prettier drops the opening brace onto its own line only for a class
    // with a non-empty body; an interface (any body) and an empty body
    // keep `{` glued to the last header line (so an empty body reads
    // `… {}`). isClass && !emptyBody captures that.
    brace := headerBrace(isClass, emptyBody, base)
    target, ok = brokenDeclarationHeader(src, base, prefix, typeParams, paramTexts, clauses, layout, brace)
    if !ok {
      return // unverified combination: abstain
    }
  }
  if target == region {
    return
  }
  ctx.ReportRangeFix(
    headerStart,
    bracePos+1,
    "Reflow class/interface header to match Prettier.",
    TextEdit{Pos: headerStart, End: bracePos + 1, Text: target},
  )
}

// declarationHeaderLayout bundles the resolved width/indent settings.
type declarationHeaderLayout struct {
  printWidth int
  tabWidth   int
  oneLevel   string
}

func (l declarationHeaderLayout) indent(base string, depth int) string {
  return base + strings.Repeat(l.oneLevel, depth)
}

func loadDeclarationHeaderLayout(ctx *Context) declarationHeaderLayout {
  var opts formatDeclarationHeaderOptions
  _ = ctx.DecodeOptions(&opts)
  l := declarationHeaderLayout{printWidth: 80, tabWidth: 2, oneLevel: "  "}
  if opts.PrintWidth != nil && *opts.PrintWidth > 0 {
    l.printWidth = *opts.PrintWidth
  }
  if opts.TabWidth != nil && *opts.TabWidth > 0 {
    l.tabWidth = *opts.TabWidth
  }
  if opts.UseTabs != nil && *opts.UseTabs {
    l.oneLevel = "\t"
  } else if opts.TabWidth != nil && *opts.TabWidth > 0 {
    l.oneLevel = strings.Repeat(" ", *opts.TabWidth)
  }
  return l
}

// heritageClauseText pairs a clause keyword with its type texts.
type heritageClauseText struct {
  keyword string
  types   []string
}

// declarationHeaderParts returns the type-parameter list, heritage clause
// list, and name node for a class or interface declaration.
func declarationHeaderParts(node *shimast.Node) (*shimast.NodeList, *shimast.NodeList, *shimast.Node) {
  switch node.Kind {
  case shimast.KindClassDeclaration:
    d := node.AsClassDeclaration()
    if d == nil {
      return nil, nil, nil
    }
    return d.TypeParameters, d.HeritageClauses, node.Name()
  case shimast.KindInterfaceDeclaration:
    d := node.AsInterfaceDeclaration()
    if d == nil {
      return nil, nil, nil
    }
    return d.TypeParameters, d.HeritageClauses, node.Name()
  }
  return nil, nil, nil
}

// nodeListTexts returns the trimmed verbatim source of each node in the
// list. ok is false if any node spans multiple lines, so the caller
// abstains rather than collapsing a multi-line element.
func nodeListTexts(src string, list *shimast.NodeList) ([]string, bool) {
  if list == nil {
    return nil, true
  }
  out := make([]string, 0, len(list.Nodes))
  for _, n := range list.Nodes {
    if n == nil {
      return nil, false
    }
    s := shimscanner.SkipTrivia(src, n.Pos())
    e := n.End()
    if s < 0 || e < s || e > len(src) {
      return nil, false
    }
    text := strings.TrimRight(src[s:e], " \t")
    if strings.ContainsRune(text, '\n') {
      return nil, false
    }
    out = append(out, text)
  }
  return out, true
}

// heritageClauseInfos extracts keyword + type texts for each heritage
// clause. ok is false on any multi-line type, so the caller abstains.
func heritageClauseInfos(src string, list *shimast.NodeList) ([]heritageClauseText, bool) {
  if list == nil {
    return nil, true
  }
  out := make([]heritageClauseText, 0, len(list.Nodes))
  for _, clauseNode := range list.Nodes {
    if clauseNode == nil {
      return nil, false
    }
    clause := clauseNode.AsHeritageClause()
    if clause == nil || clause.Types == nil {
      return nil, false
    }
    keyword := "implements"
    if clause.Token == shimast.KindExtendsKeyword {
      keyword = "extends"
    }
    types, ok := nodeListTexts(src, clause.Types)
    if !ok || len(types) == 0 {
      return nil, false
    }
    out = append(out, heritageClauseText{keyword: keyword, types: types})
  }
  return out, true
}

func flatTypeParams(params []string) string {
  if len(params) == 0 {
    return ""
  }
  return "<" + strings.Join(params, ", ") + ">"
}

func flatHeritage(clauses []heritageClauseText) string {
  var b strings.Builder
  for _, c := range clauses {
    b.WriteString(" ")
    b.WriteString(c.keyword)
    b.WriteString(" ")
    b.WriteString(strings.Join(c.types, ", "))
  }
  return b.String()
}

// brokenDeclarationHeader builds the multi-line header for the verified
// strategies, or returns ok=false for an unverified combination. `base`
// is the declaration line's leading indent; continuation lines indent
// from it while the first line keeps its existing indent (the edit
// starts at the line's first non-space byte).
func brokenDeclarationHeader(
  src string,
  base string,
  prefix string,
  typeParams *shimast.NodeList,
  paramTexts []string,
  clauses []heritageClauseText,
  layout declarationHeaderLayout,
  brace string,
) (string, bool) {
  hasTypeParams := len(paramTexts) > 0
  switch {
  case len(clauses) >= 2:
    if hasTypeParams {
      return "", false
    }
    return multiClauseHeader(prefix, clauses, layout, base, brace), true
  case len(clauses) == 1 && len(clauses[0].types) >= 2:
    if hasTypeParams {
      return "", false
    }
    return multiTypeHeader(prefix, clauses[0], layout, base, brace), true
  case hasTypeParams:
    if len(clauses) == 1 && len(clauses[0].types) >= 2 {
      return "", false
    }
    return typeParamExplodeHeader(src, base, prefix, typeParams, clauses, layout), true
  }
  return "", false
}

// multiClauseHeader: break before each keyword, types inline per clause.
// Only a class carries multiple clauses (`extends` + `implements`), so
// `brace` is the class brace placement decided by the caller.
func multiClauseHeader(prefix string, clauses []heritageClauseText, layout declarationHeaderLayout, base, brace string) string {
  var b strings.Builder
  b.WriteString(prefix)
  for _, c := range clauses {
    b.WriteString("\n")
    b.WriteString(layout.indent(base, 1))
    b.WriteString(c.keyword)
    b.WriteString(" ")
    b.WriteString(strings.Join(c.types, ", "))
  }
  b.WriteString(brace)
  return b.String()
}

// multiTypeHeader renders a single heritage clause with two or more types.
// Prettier breaks before the keyword and first tries to keep the types
// inline on that continuation line (`extends A, B, C`); it only explodes
// them one-per-line when the inline line itself still overflows. `brace`
// carries the caller's brace placement; when glued it shares the final
// line, so it is charged against the width budget for the tier decision.
func multiTypeHeader(prefix string, clause heritageClauseText, layout declarationHeaderLayout, base, brace string) string {
  indent1 := layout.indent(base, 1)
  inline := indent1 + clause.keyword + " " + strings.Join(clause.types, ", ")
  inlineWidth := visualWidth(inline, layout.tabWidth)
  if !strings.HasPrefix(brace, "\n") {
    inlineWidth += visualWidth(brace, layout.tabWidth)
  }
  if inlineWidth <= layout.printWidth {
    return prefix + "\n" + inline + brace
  }

  var b strings.Builder
  b.WriteString(prefix)
  b.WriteString("\n")
  b.WriteString(indent1)
  b.WriteString(clause.keyword)
  for i, t := range clause.types {
    b.WriteString("\n")
    b.WriteString(layout.indent(base, 2))
    b.WriteString(t)
    if i < len(clause.types)-1 {
      b.WriteString(",")
    } else {
      b.WriteString(brace)
    }
  }
  return b.String()
}

// singleGenericHeritageHeader handles the Prettier-3 shape for a lone
// heritage clause whose single type is generic with two or more type
// arguments: instead of breaking before the keyword, Prettier keeps
// `<keyword> <TypeName><` on the first line and breaks the type-argument
// list one per line, with `>` back at the declaration's base indent and
// the brace glued:
//
//  export class C implements Serializer<
//    any,
//    KafkaRequest | Promise<KafkaRequest>
//  > {
//
// The list takes no trailing comma (Prettier omits it for heritage type
// arguments) and the brace stays glued even for a class with a non-empty
// body. Returns ok=false for any shape it has not verified, type
// parameters present, more than one clause or type, a non-generic type, a
// single type argument (Prettier leaves `extends Base<OneArg>` inline even
// when it overflows), or a multi-line argument, so the caller falls back
// to the clause-breaking strategies or abstains.
//
// On a second pass the rewritten type spans multiple lines, so
// heritageClauseInfos abstains before this point and the broken form is a
// stable fixed point.
func singleGenericHeritageHeader(src, base, prefix string, typeParams, heritage *shimast.NodeList, layout declarationHeaderLayout) (string, bool) {
  if typeParams != nil && len(typeParams.Nodes) > 0 {
    return "", false
  }
  if heritage == nil || len(heritage.Nodes) != 1 || heritage.Nodes[0] == nil {
    return "", false
  }
  clause := heritage.Nodes[0].AsHeritageClause()
  if clause == nil || clause.Types == nil || len(clause.Types.Nodes) != 1 {
    return "", false
  }
  typeNode := clause.Types.Nodes[0]
  if typeNode == nil {
    return "", false
  }
  ewta := typeNode.AsExpressionWithTypeArguments()
  if ewta == nil || ewta.TypeArguments == nil || len(ewta.TypeArguments.Nodes) < 2 {
    return "", false
  }
  nameStart := shimscanner.SkipTrivia(src, typeNode.Pos())
  ltPos := typeArgsStart(src, ewta.TypeArguments)
  if nameStart < 0 || ltPos <= nameStart {
    return "", false
  }
  typeName := strings.TrimRight(src[nameStart:ltPos], " \t")
  if strings.ContainsRune(typeName, '\n') {
    return "", false
  }
  args, ok := nodeListTexts(src, ewta.TypeArguments)
  if !ok {
    return "", false
  }
  keyword := "implements"
  if clause.Token == shimast.KindExtendsKeyword {
    keyword = "extends"
  }

  var b strings.Builder
  b.WriteString(prefix)
  b.WriteString(" ")
  b.WriteString(keyword)
  b.WriteString(" ")
  b.WriteString(typeName)
  b.WriteString("<\n")
  for i, a := range args {
    b.WriteString(layout.indent(base, 1))
    b.WriteString(a)
    if i < len(args)-1 {
      b.WriteString(",")
    }
    b.WriteString("\n")
  }
  b.WriteString(base)
  b.WriteString("> {")
  return b.String(), true
}

// headerBrace returns the opening-brace fragment that closes a broken
// header. Prettier puts `{` on its own line only for a class with a
// non-empty body; an interface and any empty body keep it glued to the
// last header line.
func headerBrace(isClass, emptyBody bool, base string) string {
  if isClass && !emptyBody {
    return "\n" + base + "{"
  }
  return " {"
}

// headerBodyIsEmpty reports whether the body opened at bracePos holds no
// members, its first non-whitespace byte is the closing `}`. A body with
// a comment counts as non-empty (conservative: the comment keeps the
// brace where the source had it rather than forcing a glue).
func headerBodyIsEmpty(src string, bracePos int) bool {
  for i := bracePos + 1; i < len(src); i++ {
    switch src[i] {
    case ' ', '\t', '\r', '\n':
      continue
    case '}':
      return true
    default:
      return false
    }
  }
  return false
}

// typeParamExplodeHeader: explode the `<...>` list, heritage inline after `>`.
func typeParamExplodeHeader(
  src string,
  base string,
  prefix string,
  typeParams *shimast.NodeList,
  clauses []heritageClauseText,
  layout declarationHeaderLayout,
) string {
  var b strings.Builder
  b.WriteString(prefix)
  b.WriteString("<\n")
  paramIndent := layout.indent(base, 1)
  for _, p := range typeParams.Nodes {
    b.WriteString(renderExplodedTypeParam(src, p, layout, paramIndent))
    b.WriteString(",\n")
  }
  b.WriteString(base)
  b.WriteString(">")
  b.WriteString(flatHeritage(clauses))
  b.WriteString(" {")
  return b.String()
}

// renderExplodedTypeParam renders one type parameter on its indented
// line, breaking after `=` when `name extends C = Default` overflows.
func renderExplodedTypeParam(src string, p *shimast.Node, layout declarationHeaderLayout, paramIndent string) string {
  start := shimscanner.SkipTrivia(src, p.Pos())
  end := p.End()
  if start < 0 || end < start || end > len(src) {
    return paramIndent
  }
  full := strings.TrimRight(src[start:end], " \t")
  decl := p.AsTypeParameterDeclaration()
  // Break after `=` only when the flat parameter line overflows and the
  // parameter has a default; Prettier hangs the default one level deeper.
  if decl != nil && decl.DefaultType != nil {
    flatWidth := visualWidth(paramIndent, layout.tabWidth) + visualWidth(full, layout.tabWidth) + 1
    if flatWidth > layout.printWidth {
      defStart := shimscanner.SkipTrivia(src, decl.DefaultType.Pos())
      // Guard the slice: defStart must sit strictly inside the parameter
      // (between its name and end) for the head/default split to be sound.
      if defStart > start && defStart < end {
        head := strings.TrimRight(src[start:defStart], " \t") // ends in `=`
        def := strings.TrimSpace(src[defStart:end])
        if head != "" && def != "" {
          return paramIndent + head + "\n" + paramIndent + layout.oneLevel + def
        }
      }
    }
  }
  return paramIndent + full
}

// lineFirstNonSpace returns the offset of the first non-space, non-tab
// byte on the line containing `pos`.
func lineFirstNonSpace(src string, pos int) int {
  ls := lineStartOffset(src, pos)
  i := ls
  for i < len(src) && (src[i] == ' ' || src[i] == '\t') {
    i++
  }
  return i
}

// containsComment reports whether `s` holds a line or block comment.
func containsComment(s string) bool {
  return strings.Contains(s, "//") || strings.Contains(s, "/*")
}

func maxInt(a, b int) int {
  if a > b {
    return a
  }
  return b
}

func init() {
  Register(formatDeclarationHeader{})
}
