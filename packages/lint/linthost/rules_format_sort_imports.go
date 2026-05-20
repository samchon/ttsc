package linthost

import (
  "regexp"
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// thirdPartyModulesPlaceholder is the bucket that absorbs any import
// whose specifier doesn't match an explicit `importOrder` regex. Mirrors
// `@trivago/prettier-plugin-sort-imports`.
const thirdPartyModulesPlaceholder = "<THIRD_PARTY_MODULES>"

// formatSortImportsOptions mirrors `TtscLintRuleOptions.SortImports`.
type formatSortImportsOptions struct {
  ImportOrder                []string `json:"importOrder"`
  ImportOrderSeparation      *bool    `json:"importOrderSeparation"`
  ImportOrderSortSpecifiers  *bool    `json:"importOrderSortSpecifiers"`
  ImportOrderCaseInsensitive bool     `json:"importOrderCaseInsensitive"`
}

// defaultImportOrder mirrors the two-group MVP scheme used when the user
// supplies no explicit `importOrder`. External modules first
// (`<THIRD_PARTY_MODULES>`), relative imports second (`^\.`). The order
// matches the implicit behavior the rule shipped with before options
// landed, so omitting `importOrder` produces the same output.
var defaultImportOrder = []string{thirdPartyModulesPlaceholder, `^\.`}

// format/sort-imports orders the file's top-level import declarations into
// canonical groups and alphabetizes each group. Compatible-by-spirit with
// `@trivago/prettier-plugin-sort-imports`. Groups are user-configurable via
// the `importOrder` option; when omitted, the rule falls back to a
// two-group scheme:
//
//  1. External modules (specifier does not start with `.`).
//  2. Relative modules (specifier starts with `.`).
//
// Groups are separated by exactly one blank line (or omitted when
// `importOrderSeparation: false`). Within each group, declarations are
// sorted by their module-specifier text (ASCII order, or case-insensitive
// when `importOrderCaseInsensitive: true`). Named specifiers inside each
// declaration are alphabetized when `importOrderSortSpecifiers` is true
// (the default).
//
// Safety policy: if any byte between the contiguous imports is not
// whitespace, the rule bails. Comments anchored to specific imports would
// otherwise move with the wrong declaration, which is a strictly worse
// outcome than declining to sort.
//
// Side-effect imports (`import "foo"`), namespace imports
// (`import * as ns from`), default imports, and `import type` all
// participate in the same group based on their module specifier.
type formatSortImports struct{}

func (formatSortImports) Name() string   { return "format/sort-imports" }
func (formatSortImports) IsFormat() bool { return true }
func (formatSortImports) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

func (formatSortImports) Check(ctx *Context, node *shimast.Node) {
  if ctx == nil || ctx.File == nil {
    return
  }
  opts := loadSortImportsOptions(ctx)
  src := ctx.File.Text()
  statements := ctx.File.Statements
  if statements == nil {
    return
  }
  imports := collectLeadingImports(statements.Nodes)
  // Block-level reorder runs only when the rule can do it safely:
  // two or more contiguous imports with no comment trivia between
  // them (comments anchor to specific imports and moving them would
  // mis-attach the user's intent), AND no side-effect-only imports
  // in the block. A side-effect import (`import "./polyfill"`) runs
  // its module's top-level code for its observable effect; sorting it
  // across a sibling import that depends on the polyfill being
  // initialized first would silently change runtime behavior. The
  // rule conservatively refuses to sort the entire block in that
  // case.
  if len(imports) >= 2 &&
    leadingTriviaIsAllWhitespace(src, imports) &&
    !containsSideEffectImport(imports) {
    first := imports[0]
    last := imports[len(imports)-1]
    replaceStart := shimscanner.SkipTrivia(src, first.Pos())
    replaceEnd := last.End()
    original := src[replaceStart:replaceEnd]
    rebuilt := buildSortedImportBlock(src, imports, opts)
    if rebuilt != original {
      ctx.ReportRangeFix(
        replaceStart,
        replaceEnd,
        "Imports must be sorted into canonical groups.",
        TextEdit{Pos: replaceStart, End: replaceEnd, Text: rebuilt},
      )
      return
    }
  }
  if !opts.sortSpecifiers {
    return
  }
  for _, decl := range collectLeadingImports(statements.Nodes) {
    reportNamedSpecifierSort(ctx, decl, opts.caseInsensitive)
  }
}

// resolvedSortImportsOptions is the normalized snapshot the rule uses
// during one Check call. All option defaults are applied here so the
// rest of the rule code does not branch on nil-ness.
type resolvedSortImportsOptions struct {
  groups          []sortImportsGroup
  separation      bool
  sortSpecifiers  bool
  caseInsensitive bool
}

type sortImportsGroup struct {
  raw        string
  pattern    *regexp.Regexp
  thirdParty bool
}

func loadSortImportsOptions(ctx *Context) resolvedSortImportsOptions {
  var raw formatSortImportsOptions
  _ = ctx.DecodeOptions(&raw)
  order := raw.ImportOrder
  if len(order) == 0 {
    order = defaultImportOrder
  }
  groups := make([]sortImportsGroup, 0, len(order))
  for _, pat := range order {
    if pat == thirdPartyModulesPlaceholder {
      groups = append(groups, sortImportsGroup{raw: pat, thirdParty: true})
      continue
    }
    compiled, err := regexp.Compile(pat)
    if err != nil {
      // Bad regex: skip the group rather than failing the entire run.
      // The diagnostic surface for misconfigured rules is intentionally
      // limited; users see "no match" behavior instead of a crash.
      continue
    }
    groups = append(groups, sortImportsGroup{raw: pat, pattern: compiled})
  }
  if len(groups) == 0 {
    // Empty `importOrder` collapses to the third-party catchall so the
    // rule still produces a deterministic ordering.
    groups = []sortImportsGroup{{raw: thirdPartyModulesPlaceholder, thirdParty: true}}
  }
  // Ensure a third-party catchall exists; if the user omitted it,
  // append one so unmatched specifiers don't land in a phantom group.
  if !hasThirdPartyGroup(groups) {
    groups = append(groups, sortImportsGroup{raw: thirdPartyModulesPlaceholder, thirdParty: true})
  }
  separation := true
  if raw.ImportOrderSeparation != nil {
    separation = *raw.ImportOrderSeparation
  }
  sortSpecifiers := true
  if raw.ImportOrderSortSpecifiers != nil {
    sortSpecifiers = *raw.ImportOrderSortSpecifiers
  }
  return resolvedSortImportsOptions{
    groups:          groups,
    separation:      separation,
    sortSpecifiers:  sortSpecifiers,
    caseInsensitive: raw.ImportOrderCaseInsensitive,
  }
}

// hasThirdPartyGroup reports whether at least one group in the list is the
// third-party catchall. Used to decide whether a sentinel needs to be appended.
func hasThirdPartyGroup(groups []sortImportsGroup) bool {
  for _, g := range groups {
    if g.thirdParty {
      return true
    }
  }
  return false
}

// matchGroup returns the index of the first group that claims `specifier`.
// Non-third-party groups are checked in order; the third-party catchall
// absorbs anything that did not match an earlier explicit pattern.
func matchGroup(groups []sortImportsGroup, specifier string) int {
  thirdPartyIdx := -1
  for i, g := range groups {
    if g.thirdParty {
      if thirdPartyIdx < 0 {
        thirdPartyIdx = i
      }
      continue
    }
    if g.pattern != nil && g.pattern.MatchString(specifier) {
      return i
    }
  }
  if thirdPartyIdx >= 0 {
    return thirdPartyIdx
  }
  return len(groups) // sentinel "no match"
}

// specifierListHasCommentTrivia returns true when the source between
// adjacent specifiers contains any byte that is not whitespace,
// comma, or whitespace-equivalent. A `/* x */` or `// x` inside the
// list anchors the rule into a no-op — sorting would re-emit the
// specifier texts joined with `", "` and silently drop the comment.
func specifierListHasCommentTrivia(src string, specifiers []*shimast.Node) bool {
  for i := 1; i < len(specifiers); i++ {
    prev := specifiers[i-1]
    curr := specifiers[i]
    if prev == nil || curr == nil {
      continue
    }
    start := prev.End()
    end := shimscanner.SkipTrivia(src, curr.Pos())
    for j := start; j < end; j++ {
      c := src[j]
      if c == ' ' || c == '\t' || c == '\r' || c == '\n' || c == ',' {
        continue
      }
      return true
    }
  }
  return false
}

// containsSideEffectImport reports whether any import in the contiguous
// block has no import clause (i.e. is a side-effect-only `import "x"`).
// These imports are evaluated for their top-level effect; their order
// relative to other imports may carry meaning the rule cannot reason
// about, so the safety policy is to refuse to sort.
func containsSideEffectImport(imports []*shimast.Node) bool {
  for _, decl := range imports {
    if decl == nil {
      continue
    }
    imp := decl.AsImportDeclaration()
    if imp == nil {
      continue
    }
    if imp.ImportClause == nil {
      return true
    }
  }
  return false
}

// collectLeadingImports walks the file's statement list and returns the
// contiguous run of ImportDeclaration nodes at its head. Stops at the
// first non-import statement because moving an import across an
// expression statement could change runtime evaluation order.
func collectLeadingImports(stmts []*shimast.Node) []*shimast.Node {
  out := make([]*shimast.Node, 0)
  for _, stmt := range stmts {
    if stmt == nil || stmt.Kind != shimast.KindImportDeclaration {
      break
    }
    out = append(out, stmt)
  }
  return out
}

// leadingTriviaIsAllWhitespace returns true when the source between each
// adjacent import declaration contains no comment bytes. Comments anchor
// the rule into a no-op because moving imports could mis-attach them.
func leadingTriviaIsAllWhitespace(src string, imports []*shimast.Node) bool {
  for i := 1; i < len(imports); i++ {
    prevEnd := imports[i-1].End()
    currStart := shimscanner.SkipTrivia(src, imports[i].Pos())
    for j := prevEnd; j < currStart; j++ {
      c := src[j]
      if c != ' ' && c != '\t' && c != '\r' && c != '\n' {
        return false
      }
    }
  }
  return true
}

// buildSortedImportBlock returns the canonical group/sort representation of
// the contiguous import declarations.
func buildSortedImportBlock(src string, imports []*shimast.Node, opts resolvedSortImportsOptions) string {
  type entry struct {
    group     int
    specifier string
    sortKey   string
    text      string
  }
  entries := make([]entry, 0, len(imports))
  for _, decl := range imports {
    spec := moduleSpecifierText(decl)
    text := importStatementText(src, decl)
    sortKey := spec
    if opts.caseInsensitive {
      sortKey = strings.ToLower(spec)
    }
    entries = append(entries, entry{
      group:     matchGroup(opts.groups, spec),
      specifier: spec,
      sortKey:   sortKey,
      text:      text,
    })
  }
  sort.SliceStable(entries, func(i, j int) bool {
    if entries[i].group != entries[j].group {
      return entries[i].group < entries[j].group
    }
    return entries[i].sortKey < entries[j].sortKey
  })

  var b strings.Builder
  prevGroup := entries[0].group
  for i, e := range entries {
    if i > 0 {
      if e.group != prevGroup && opts.separation {
        b.WriteString("\n\n")
      } else {
        b.WriteString("\n")
      }
    }
    b.WriteString(e.text)
    prevGroup = e.group
  }
  return b.String()
}

// importStatementText returns the import declaration's source text,
// stripped of any leading whitespace/comment trivia.
func importStatementText(src string, decl *shimast.Node) string {
  start := shimscanner.SkipTrivia(src, decl.Pos())
  end := decl.End()
  if start < 0 || start > end || end > len(src) {
    return ""
  }
  return src[start:end]
}

// moduleSpecifierText returns the unquoted module specifier of an
// ImportDeclaration, or "" when the AST shape is unexpected.
func moduleSpecifierText(decl *shimast.Node) string {
  if decl == nil {
    return ""
  }
  imp := decl.AsImportDeclaration()
  if imp == nil || imp.ModuleSpecifier == nil {
    return ""
  }
  return stringLiteralText(imp.ModuleSpecifier)
}

// specifierEntry is the sortable pair captured for each named import
// specifier: the identifier used as the sort key and the literal source
// text that gets re-emitted in canonical order.
type specifierEntry struct {
  key  string
  text string
}

// reportNamedSpecifierSort reports a fix when an import's `{ a, b }` list
// is out of alphabetical order. Type-only specifiers participate in the
// same sort key as value specifiers — prettier's plugin-sort-imports
// matches this behavior.
//
// Safety policy: comment trivia between specifiers anchors the rule
// into a no-op. The rule rejoins specifier text with `", "`, which
// would discard any `/* x */` comment carried inside the list. The
// block-level sort applies the same policy via
// `leadingTriviaIsAllWhitespace`; this is the per-specifier analog.
func reportNamedSpecifierSort(ctx *Context, decl *shimast.Node, caseInsensitive bool) {
  imp := decl.AsImportDeclaration()
  if imp == nil || imp.ImportClause == nil {
    return
  }
  clause := imp.ImportClause.AsImportClause()
  if clause == nil || clause.NamedBindings == nil {
    return
  }
  if clause.NamedBindings.Kind != shimast.KindNamedImports {
    return
  }
  named := clause.NamedBindings.AsNamedImports()
  if named == nil || named.Elements == nil || len(named.Elements.Nodes) < 2 {
    return
  }
  src := ctx.File.Text()
  specifiers := named.Elements.Nodes
  if specifierListHasCommentTrivia(src, specifiers) {
    return
  }

  entries := make([]specifierEntry, 0, len(specifiers))
  for _, spec := range specifiers {
    if spec == nil {
      continue
    }
    s := spec.AsImportSpecifier()
    if s == nil {
      return // unexpected shape; bail
    }
    name := identifierText(s.Name())
    if name == "" {
      return
    }
    start := shimscanner.SkipTrivia(src, spec.Pos())
    end := spec.End()
    key := name
    if caseInsensitive {
      key = strings.ToLower(name)
    }
    entries = append(entries, specifierEntry{
      key:  key,
      text: src[start:end],
    })
  }
  if len(entries) < 2 {
    return
  }
  sorted := make([]specifierEntry, len(entries))
  copy(sorted, entries)
  sort.SliceStable(sorted, func(i, j int) bool {
    return sorted[i].key < sorted[j].key
  })
  changed := false
  for i := range entries {
    if entries[i].key != sorted[i].key {
      changed = true
      break
    }
  }
  if !changed {
    return
  }
  firstStart := shimscanner.SkipTrivia(src, specifiers[0].Pos())
  lastEnd := specifiers[len(specifiers)-1].End()
  rebuilt := joinSortedSpecifiers(sorted)
  if src[firstStart:lastEnd] == rebuilt {
    return
  }
  ctx.ReportRangeFix(
    firstStart,
    lastEnd,
    "Named import specifiers must be sorted alphabetically.",
    TextEdit{Pos: firstStart, End: lastEnd, Text: rebuilt},
  )
}

// joinSortedSpecifiers returns the specifier texts joined with ", " in their
// already-sorted order. The caller owns the sort; this is a formatting step only.
func joinSortedSpecifiers(entries []specifierEntry) string {
  texts := make([]string, len(entries))
  for i, e := range entries {
    texts[i] = e.text
  }
  return strings.Join(texts, ", ")
}

func init() {
  Register(formatSortImports{})
}
