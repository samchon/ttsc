package linthost

import (
  "regexp"
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// Group-order placeholders accepted inside the `order` option. A single
// declarative array expresses group order, blank-line separation, and special
// groups all by position.
const (
  // builtinModulesPlaceholder buckets Node built-in modules (`fs`,
  // `node:path`, `fs/promises`, ...).
  builtinModulesPlaceholder = "<BUILTIN_MODULES>"
  // thirdPartyModulesPlaceholder absorbs any specifier that matched no
  // earlier explicit group.
  thirdPartyModulesPlaceholder = "<THIRD_PARTY_MODULES>"
  // typesPlaceholderPrefix marks the group of `import type` declarations.
  // A regex may follow (`<TYPES>^[.]`) to scope the group to matching
  // specifiers.
  typesPlaceholderPrefix = "<TYPES>"
  // separatorPlaceholder ("") emits one blank line at its position.
  separatorPlaceholder = ""
)

// formatSortImportsOptions mirrors `ITtscLintFormatSortImports`.
type formatSortImportsOptions struct {
  Order               []string `json:"order"`
  CaseSensitive       bool     `json:"caseSensitive"`
  CombineTypeAndValue bool     `json:"combineTypeAndValue"`
}

// defaultImportOrder is used when the user supplies no `order`: Node built-ins,
// then the third-party catch-all, then relative imports. No `""` entries, so
// the default emits no blank lines between groups (blank lines are opt-in by
// position).
var defaultImportOrder = []string{
  builtinModulesPlaceholder,
  thirdPartyModulesPlaceholder,
  `^[.]`,
}

// formatSortImports orders the file's top-level import declarations into
// canonical groups, alphabetizes each group, merges duplicate imports of the
// same module, and (when `combineTypeAndValue` is on) folds a type-only
// import into a value import of the same module. Groups are user-configurable
// via the `order` option; when omitted, the rule falls back to {@link
// defaultImportOrder}.
//
// Within each group, declarations are sorted by their module-specifier text
// (ASCII order, or case-insensitive unless `caseSensitive: true`). Named
// specifiers inside each declaration are always sorted.
//
// Safety policy: if any byte between the contiguous imports is not
// whitespace, the rule bails. Comments anchored to specific imports would
// otherwise move with the wrong declaration, which is a strictly worse
// outcome than declining to sort. Side-effect imports (`import "foo"`) also
// bail the whole block because their evaluation order can carry meaning the
// rule cannot reason about.
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
  // rule conservatively refuses to reorder the entire block in that
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
  for _, decl := range imports {
    reportNamedSpecifierSort(ctx, decl, opts.caseSensitive)
  }
}

// resolvedSortImportsOptions is the normalized snapshot the rule uses
// during one Check call. All option defaults are applied here so the
// rest of the rule code does not branch on nil-ness.
type resolvedSortImportsOptions struct {
  groups              []sortImportsGroup
  caseSensitive       bool
  combineTypeAndValue bool
}

// sortImportsGroup is one resolved entry of the `order` array. A separator
// entry ("") is not a real group; it is folded into the following group's
// sepBefore flag during parsing and never appears in the resolved list.
type sortImportsGroup struct {
  raw        string
  pattern    *regexp.Regexp // nil for placeholder groups without a regex
  thirdParty bool
  builtin    bool
  typesOnly  bool // <TYPES> group: matches `import type` declarations
  sepBefore  bool // a "" preceded this group in the `order` array
}

func loadSortImportsOptions(ctx *Context) resolvedSortImportsOptions {
  var raw formatSortImportsOptions
  _ = ctx.DecodeOptions(&raw)
  order := raw.Order
  if len(order) == 0 {
    order = defaultImportOrder
  }
  groups := parseImportOrder(order)
  return resolvedSortImportsOptions{
    groups:              groups,
    caseSensitive:       raw.CaseSensitive,
    combineTypeAndValue: raw.CombineTypeAndValue,
  }
}

// parseImportOrder turns the raw `order` array into resolved groups. "" entries
// fold into the next group's sepBefore flag. A third-party catch-all is
// injected at the front when the user omitted one so unmatched specifiers
// always land in a real group rather than after every explicit one.
func parseImportOrder(order []string) []sortImportsGroup {
  groups := make([]sortImportsGroup, 0, len(order))
  pendingSep := false
  for _, pat := range order {
    if pat == separatorPlaceholder {
      pendingSep = true
      continue
    }
    group, ok := compileImportOrderGroup(pat)
    if !ok {
      // Bad regex: skip the group rather than failing the entire run.
      // Users see "no match" behavior instead of a crash; a stray
      // separator in front of the skipped group carries to the next.
      continue
    }
    group.sepBefore = pendingSep
    pendingSep = false
    groups = append(groups, group)
  }
  if !hasThirdPartyGroup(groups) {
    groups = append([]sortImportsGroup{{raw: thirdPartyModulesPlaceholder, thirdParty: true}}, groups...)
  }
  return groups
}

// compileImportOrderGroup resolves one non-separator `order` entry into a
// group. The bool is false only when a regex entry fails to compile.
func compileImportOrderGroup(pat string) (sortImportsGroup, bool) {
  switch {
  case pat == builtinModulesPlaceholder:
    return sortImportsGroup{raw: pat, builtin: true}, true
  case pat == thirdPartyModulesPlaceholder:
    return sortImportsGroup{raw: pat, thirdParty: true}, true
  case strings.HasPrefix(pat, typesPlaceholderPrefix):
    rest := strings.TrimPrefix(pat, typesPlaceholderPrefix)
    group := sortImportsGroup{raw: pat, typesOnly: true}
    if rest == "" {
      return group, true
    }
    compiled, err := regexp.Compile(rest)
    if err != nil {
      return sortImportsGroup{}, false
    }
    group.pattern = compiled
    return group, true
  default:
    compiled, err := regexp.Compile(pat)
    if err != nil {
      return sortImportsGroup{}, false
    }
    return sortImportsGroup{raw: pat, pattern: compiled}, true
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

// matchGroup returns the index of the first group that claims a declaration
// with the given specifier and type-only flag. Groups are checked in order, so
// a `<TYPES>` group placed ahead of a regex group claims type-only imports
// first; the third-party catchall absorbs anything left over.
func matchGroup(groups []sortImportsGroup, specifier string, typeOnly bool) int {
  thirdPartyIdx := -1
  for i, g := range groups {
    switch {
    case g.thirdParty:
      if thirdPartyIdx < 0 {
        thirdPartyIdx = i
      }
    case g.builtin:
      if isBuiltinModule(specifier) {
        return i
      }
    case g.typesOnly:
      if typeOnly && (g.pattern == nil || g.pattern.MatchString(specifier)) {
        return i
      }
    case g.pattern != nil && g.pattern.MatchString(specifier):
      return i
    }
  }
  return thirdPartyIdx
}

// nodeBuiltinModules is the set of Node.js built-in module names recognized by
// the `<BUILTIN_MODULES>` group. A `node:` prefix and a `pkg/subpath` suffix
// are both stripped before the lookup.
var nodeBuiltinModules = map[string]struct{}{
  "assert": {}, "async_hooks": {}, "buffer": {}, "child_process": {},
  "cluster": {}, "console": {}, "constants": {}, "crypto": {},
  "dgram": {}, "diagnostics_channel": {}, "dns": {}, "domain": {},
  "events": {}, "fs": {}, "http": {}, "http2": {}, "https": {},
  "inspector": {}, "module": {}, "net": {}, "os": {}, "path": {},
  "perf_hooks": {}, "process": {}, "punycode": {}, "querystring": {},
  "readline": {}, "repl": {}, "stream": {}, "string_decoder": {},
  "sys": {}, "test": {}, "timers": {}, "tls": {}, "trace_events": {},
  "tty": {}, "url": {}, "util": {}, "v8": {}, "vm": {}, "wasi": {},
  "worker_threads": {}, "zlib": {},
}

// isBuiltinModule reports whether the specifier names a Node.js built-in
// module. `node:fs`, `fs`, and `fs/promises` all qualify.
func isBuiltinModule(specifier string) bool {
  name := strings.TrimPrefix(specifier, "node:")
  if slash := strings.IndexByte(name, '/'); slash >= 0 {
    name = name[:slash]
  }
  _, ok := nodeBuiltinModules[name]
  return ok
}

// specifierListHasCommentTrivia returns true when the source between
// adjacent specifiers contains any byte that is not whitespace,
// comma, or whitespace-equivalent. A `/* x */` or `// x` inside the
// list anchors the rule into a no-op, sorting would re-emit the
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

// siSpec is one named import specifier captured for merge/sort: its local
// name drives the sort key, its source text is re-emitted verbatim, and the
// type-only flag of the owning declaration drives `combineTypeAndValue`
// promotion.
type siSpec struct {
  sortKey          string
  text             string
  fromTypeOnlyDecl bool
}

// siDecl is the parsed shape of one import declaration used by the block
// rebuilder. Declarations with a namespace binding are not mergeable and are
// re-emitted from their original text.
type siDecl struct {
  specifier   string
  specRaw     string
  typeOnly    bool
  defaultName string
  named       []siSpec
  namespace   bool
  original    string
  semicolon   bool
}

// siEntry is a (possibly merged) import declaration ready to be grouped,
// sorted, and emitted.
type siEntry struct {
  group     int
  specifier string
  sortKey   string
  typeOnly  bool
  text      string
}

// buildSortedImportBlock returns the canonical group/sort/merge representation
// of the contiguous import declarations.
func buildSortedImportBlock(src string, imports []*shimast.Node, opts resolvedSortImportsOptions) string {
  decls := make([]siDecl, 0, len(imports))
  for _, decl := range imports {
    decls = append(decls, parseImportDecl(src, decl))
  }
  entries := mergeImportDecls(decls, opts)
  for i := range entries {
    entries[i].group = matchGroup(opts.groups, entries[i].specifier, entries[i].typeOnly)
    entries[i].sortKey = foldCase(entries[i].specifier, opts.caseSensitive)
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
      if e.group != prevGroup && separatorBetween(opts.groups, prevGroup, e.group) {
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

// separatorBetween reports whether a blank line should sit between two
// consecutive (in sorted output) groups. Groups skipped because they had no
// imports still contribute their sepBefore flag, so `[A, "", B]` with an empty
// A and B that both fall through to a later group collapses to one blank line.
func separatorBetween(groups []sortImportsGroup, prev, curr int) bool {
  for k := prev + 1; k <= curr && k < len(groups); k++ {
    if groups[k].sepBefore {
      return true
    }
  }
  return false
}

// parseImportDecl captures the merge-relevant shape of one import declaration.
func parseImportDecl(src string, decl *shimast.Node) siDecl {
  out := siDecl{
    specifier: moduleSpecifierText(decl),
    specRaw:   moduleSpecifierRaw(src, decl),
    original:  importStatementText(src, decl),
  }
  out.semicolon = strings.HasSuffix(out.original, ";")
  imp := decl.AsImportDeclaration()
  if imp == nil || imp.ImportClause == nil {
    return out
  }
  clause := imp.ImportClause.AsImportClause()
  if clause == nil {
    return out
  }
  out.typeOnly = clause.PhaseModifier == shimast.KindTypeKeyword
  out.defaultName = identifierText(clause.Name())
  if clause.NamedBindings == nil {
    return out
  }
  if clause.NamedBindings.Kind == shimast.KindNamespaceImport {
    out.namespace = true
    return out
  }
  if clause.NamedBindings.Kind != shimast.KindNamedImports {
    return out
  }
  named := clause.NamedBindings.AsNamedImports()
  if named == nil || named.Elements == nil {
    return out
  }
  for _, spec := range named.Elements.Nodes {
    s := spec.AsImportSpecifier()
    if s == nil {
      continue
    }
    start := shimscanner.SkipTrivia(src, spec.Pos())
    out.named = append(out.named, siSpec{
      sortKey:          identifierText(s.Name()),
      text:             src[start:spec.End()],
      fromTypeOnlyDecl: out.typeOnly,
    })
  }
  return out
}

// mergeImportDecls collapses declarations of the same module into one entry.
// Same-module value imports always merge; same-module type-only imports always
// merge; a value import and a type-only import of the same module merge only
// when `combineTypeAndValue` is set. Namespace imports and merge conflicts fall
// back to one entry per original declaration.
func mergeImportDecls(decls []siDecl, opts resolvedSortImportsOptions) []siEntry {
  order := make([]string, 0, len(decls))
  buckets := make(map[string][]siDecl)
  for _, d := range decls {
    key := mergeKey(d, opts.combineTypeAndValue)
    if _, seen := buckets[key]; !seen {
      order = append(order, key)
    }
    buckets[key] = append(buckets[key], d)
  }
  entries := make([]siEntry, 0, len(decls))
  for _, key := range order {
    entries = append(entries, mergeBucket(buckets[key], opts)...)
  }
  return entries
}

// mergeKey groups declarations that are eligible to merge. Namespace imports
// get a unique key (a per-declaration counter via the original text plus a
// sentinel) so they never merge.
func mergeKey(d siDecl, combine bool) string {
  if d.namespace {
    return "\x00ns\x00" + d.original
  }
  if combine || !d.typeOnly {
    return "v\x00" + d.specifier
  }
  return "t\x00" + d.specifier
}

// mergeBucket renders a bucket of same-key declarations. A single declaration
// (or an unmergeable conflict) is emitted from its original text; otherwise the
// declarations fold into one rebuilt statement.
func mergeBucket(group []siDecl, opts resolvedSortImportsOptions) []siEntry {
  if len(group) == 1 {
    return []siEntry{originalEntry(group[0])}
  }
  text, typeOnly, ok := renderMergedDecl(group, opts)
  if !ok {
    out := make([]siEntry, 0, len(group))
    for _, d := range group {
      out = append(out, originalEntry(d))
    }
    return out
  }
  return []siEntry{{specifier: group[0].specifier, typeOnly: typeOnly, text: text}}
}

// originalEntry wraps one declaration's untouched source text as an entry.
func originalEntry(d siDecl) siEntry {
  return siEntry{specifier: d.specifier, typeOnly: d.typeOnly, text: d.original}
}

// renderMergedDecl folds a bucket of mergeable declarations into one statement.
// It returns the rendered text, whether the merged result is a type-only import,
// and an `ok` flag that is false when the declarations cannot be merged
// (conflicting default names, or a type-only default that cannot survive in a
// mixed value import).
func renderMergedDecl(group []siDecl, opts resolvedSortImportsOptions) (string, bool, bool) {
  mergedTypeOnly := true
  for _, d := range group {
    if !d.typeOnly {
      mergedTypeOnly = false
    }
  }
  defaultName := ""
  defaultTypeOnly := false
  for _, d := range group {
    if d.defaultName == "" {
      continue
    }
    if defaultName != "" && defaultName != d.defaultName {
      return "", false, false
    }
    defaultName = d.defaultName
    defaultTypeOnly = d.typeOnly
  }
  // A type-only default cannot be expressed inside a mixed value import
  // (`import type Foo, { value }` would retype `value`).
  if defaultName != "" && defaultTypeOnly && !mergedTypeOnly {
    return "", false, false
  }
  specs := collectMergedSpecs(group, mergedTypeOnly, opts.caseSensitive)
  if defaultName == "" && len(specs) == 0 {
    return "", false, false
  }

  var b strings.Builder
  b.WriteString("import ")
  if mergedTypeOnly {
    b.WriteString("type ")
  }
  if defaultName != "" {
    b.WriteString(defaultName)
    if len(specs) > 0 {
      b.WriteString(", ")
    }
  }
  if len(specs) > 0 {
    b.WriteString("{ ")
    b.WriteString(strings.Join(specs, ", "))
    b.WriteString(" }")
  }
  b.WriteString(" from ")
  b.WriteString(group[0].specRaw)
  if group[0].semicolon {
    b.WriteString(";")
  }
  return b.String(), mergedTypeOnly, true
}

// collectMergedSpecs gathers, de-duplicates, and sorts the named specifiers of
// a merged declaration. A specifier from a type-only declaration folded into a
// mixed value import gains an inline `type ` prefix. Specifiers are
// de-duplicated by local binding name — keeping the value form, since one
// binding cannot be both a value and a type import — and ordered value before
// type, then by name.
func collectMergedSpecs(group []siDecl, mergedTypeOnly, caseSensitive bool) []string {
  type spec struct {
    name   string
    isType bool
    text   string
  }
  index := make(map[string]int)
  items := make([]spec, 0)
  for _, d := range group {
    for _, s := range d.named {
      text := s.text
      if s.fromTypeOnlyDecl && !mergedTypeOnly && !strings.HasPrefix(text, "type ") {
        text = "type " + text
      }
      cur := spec{name: s.sortKey, isType: strings.HasPrefix(text, "type "), text: text}
      if at, dup := index[s.sortKey]; dup {
        if items[at].isType && !cur.isType {
          items[at] = cur
        }
        continue
      }
      index[s.sortKey] = len(items)
      items = append(items, cur)
    }
  }
  sort.SliceStable(items, func(i, j int) bool {
    if items[i].isType != items[j].isType {
      return !items[i].isType
    }
    return foldCase(items[i].name, caseSensitive) < foldCase(items[j].name, caseSensitive)
  })
  texts := make([]string, len(items))
  for i, it := range items {
    texts[i] = it.text
  }
  return texts
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

// moduleSpecifierRaw returns the module specifier's source text including its
// surrounding quotes, so a merged declaration preserves the original quote
// style.
func moduleSpecifierRaw(src string, decl *shimast.Node) string {
  imp := decl.AsImportDeclaration()
  if imp == nil || imp.ModuleSpecifier == nil {
    return ""
  }
  start := shimscanner.SkipTrivia(src, imp.ModuleSpecifier.Pos())
  end := imp.ModuleSpecifier.End()
  if start < 0 || start > end || end > len(src) {
    return ""
  }
  return src[start:end]
}

// foldCase lowercases `s` unless case-sensitive ordering was requested.
func foldCase(s string, caseSensitive bool) string {
  if caseSensitive {
    return s
  }
  return strings.ToLower(s)
}

// specifierEntry is the sortable record captured for each named import
// specifier: the local name used as the sort key, whether it is an inline
// `type` specifier (those sort after value specifiers), and the literal source
// text that gets re-emitted in canonical order.
type specifierEntry struct {
  key    string
  isType bool
  text   string
}

// reportNamedSpecifierSort reports a fix when an import's `{ a, b }` list
// is out of alphabetical order. Type-only specifiers participate in the
// same sort key as value specifiers, prettier's plugin-sort-imports
// matches this behavior.
//
// Safety policy: comment trivia between specifiers anchors the rule
// into a no-op. The rule rejoins specifier text with `", "`, which
// would discard any `/* x */` comment carried inside the list. The
// block-level sort applies the same policy via
// `leadingTriviaIsAllWhitespace`; this is the per-specifier analog.
func reportNamedSpecifierSort(ctx *Context, decl *shimast.Node, caseSensitive bool) {
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
    entries = append(entries, specifierEntry{
      key:    foldCase(name, caseSensitive),
      isType: s.IsTypeOnly,
      text:   src[start:end],
    })
  }
  if len(entries) < 2 {
    return
  }
  sorted := make([]specifierEntry, len(entries))
  copy(sorted, entries)
  sort.SliceStable(sorted, func(i, j int) bool {
    if sorted[i].isType != sorted[j].isType {
      return !sorted[i].isType
    }
    return sorted[i].key < sorted[j].key
  })
  changed := false
  for i := range entries {
    if entries[i].key != sorted[i].key || entries[i].isType != sorted[i].isType {
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
