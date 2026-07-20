package paths

import (
  "path/filepath"
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

func init() {
  driver.RegisterPlugin(plugin{})
}

// plugin implements driver.ProgramPlugin for @ttsc/paths.
type plugin struct{}

// ApplyProgram rewrites tsconfig paths aliases to relative import specifiers
// across every source file in the program.
func (plugin) ApplyProgram(prog *driver.Program, _ driver.PluginContext) error {
  rewriter := newRewriter(prog)
  for _, file := range prog.SourceFiles() {
    rewriter.apply(file)
  }
  return nil
}

// rewriter holds the resolved tsconfig paths configuration used to rewrite
// module specifiers across an entire program.
type rewriter struct {
  checker     *shimchecker.Checker
  basePath    string
  jsxPreserve bool
  outDir      string
  patterns    []pathPattern
  rootDir     string
  sourceFiles map[string]string // normalized source path → same path (used as a set)
}

// pathPattern is a single tsconfig paths entry with its wildcard pattern and
// ordered list of substitution targets.
type pathPattern struct {
  pattern string
  targets []string
}

var sourceLookupExtensions = []string{
  ".ts", ".tsx", ".mts", ".cts",
  ".js", ".jsx", ".mjs", ".cjs",
}

// newRewriter builds a rewriter from the program's compiler options.
// Patterns are sorted by decreasing specificity (longer literal prefix first)
// so the most-specific match wins on overlapping patterns.
func newRewriter(prog *driver.Program) *rewriter {
  out := &rewriter{sourceFiles: map[string]string{}}
  if prog == nil || prog.ParsedConfig == nil || prog.ParsedConfig.ParsedConfig == nil || prog.ParsedConfig.ParsedConfig.CompilerOptions == nil {
    return out
  }
  out.checker = prog.Checker
  options := prog.ParsedConfig.ParsedConfig.CompilerOptions
  cwd := prog.Host.GetCurrentDirectory()
  out.basePath = filepath.Clean(options.GetPathsBasePath(cwd))
  out.jsxPreserve = options.Jsx == shimcore.JsxEmitPreserve
  out.outDir = optionalPath(options.OutDir, cwd)
  out.rootDir = optionalPath(options.RootDir, cwd)
  files := prog.SourceFiles()
  fileNames := make([]string, 0, len(files))
  for _, file := range files {
    fileNames = append(fileNames, normalizePath(file.FileName()))
  }
  if out.rootDir == "" {
    out.rootDir = inferredRootDir(options.ConfigFilePath, fileNames, cwd, useCaseSensitiveFileNames(prog))
  }
  for _, name := range fileNames {
    out.sourceFiles[name] = name
  }
  if options.Paths != nil {
    for key, targets := range options.Paths.Entries() {
      out.patterns = append(out.patterns, pathPattern{
        pattern: key,
        targets: append([]string(nil), targets...),
      })
    }
  }
  orderPatterns(out.patterns)
  return out
}

// useCaseSensitiveFileNames reports the host filesystem's case sensitivity,
// defaulting to case-sensitive when the program carries no filesystem (bare
// rewriters built by unit tests).
func useCaseSensitiveFileNames(prog *driver.Program) bool {
  if prog == nil || prog.FS == nil {
    return true
  }
  return prog.FS.UseCaseSensitiveFileNames()
}

// apply rewrites all module specifiers in file that match a tsconfig paths pattern.
func (r *rewriter) apply(file *shimast.SourceFile) {
  if r == nil || file == nil || len(r.patterns) == 0 {
    return
  }
  visitModuleSpecifiers(file, r.checker, func(lit *shimast.Node) {
    if lit == nil || lit.Kind != shimast.KindStringLiteral {
      return
    }
    spec := lit.Text()
    rewritten, ok := r.rewrite(file.FileName(), spec)
    if ok && rewritten != spec {
      lit.AsStringLiteral().Text = rewritten
      lit.Flags |= shimast.NodeFlagsSynthesized
      lit.Loc = shimcore.UndefinedTextRange()
    }
  })
}

// visitModuleSpecifiers recursively walks file, calling visit for every
// string-literal module reference it finds. Syntax identifies candidates, then
// SourceFile and Checker facts exclude declarations and calls whose literal is
// not actually a module reference in the containing file.
//
// The recursion runs through one closure created per walk, not one per node:
// handing ForEachChild a fresh closure at every node would allocate once per
// AST node across the whole program on every apply pass.
func visitModuleSpecifiers(file *shimast.SourceFile, checker *shimchecker.Checker, visit func(*shimast.Node)) {
  if file == nil {
    return
  }
  var walk func(node *shimast.Node) bool
  walk = func(node *shimast.Node) bool {
    if node == nil {
      return false
    }
    switch node.Kind {
    case shimast.KindImportDeclaration:
      visit(node.AsImportDeclaration().ModuleSpecifier)
    case shimast.KindExportDeclaration:
      visit(node.AsExportDeclaration().ModuleSpecifier)
    case shimast.KindImportEqualsDeclaration:
      ref := node.AsImportEqualsDeclaration().ModuleReference
      if ref != nil && ref.Kind == shimast.KindExternalModuleReference {
        visit(ref.AsExternalModuleReference().Expression)
      }
    case shimast.KindImportType:
      arg := node.AsImportTypeNode().Argument
      if arg != nil && arg.Kind == shimast.KindLiteralType {
        visit(arg.AsLiteralTypeNode().Literal)
      }
    case shimast.KindModuleDeclaration:
      decl := node.AsModuleDeclaration()
      if file.ExternalModuleIndicator != nil && decl != nil {
        visit(decl.Name())
      }
    case shimast.KindCallExpression:
      call := node.AsCallExpression()
      if isModuleSpecifierCall(checker, call) && call.Arguments != nil && len(call.Arguments.Nodes) > 0 {
        visit(call.Arguments.Nodes[0])
      }
    }
    node.ForEachChild(walk)
    return false
  }
  walk(file.AsNode())
}

// isModuleSpecifierCall reports whether call is a dynamic import() or a
// CommonJS require() expression that resolves to the module loader.
func isModuleSpecifierCall(checker *shimchecker.Checker, call *shimast.CallExpression) bool {
  if call == nil || call.Expression == nil {
    return false
  }
  switch call.Expression.Kind {
  case shimast.KindImportKeyword:
    return true
  case shimast.KindIdentifier:
    return call.Expression.Text() == "require" && isModuleLoader(checker, call.Expression)
  default:
    return false
  }
}

// isModuleLoader reports whether expression names the CommonJS loader rather
// than a parameter, local, or imported binding named require. An unresolved
// bare require is the runtime CommonJS global; declared loaders are ambient.
func isModuleLoader(checker *shimchecker.Checker, expression *shimast.Node) bool {
  if checker == nil || expression == nil {
    return false
  }
  symbol := checker.GetSymbolAtLocation(expression)
  if symbol == nil {
    return true
  }
  return symbol.Flags&shimast.SymbolFlagsAlias == 0 &&
    symbol.ValueDeclaration != nil &&
    symbol.ValueDeclaration.Flags&shimast.NodeFlagsAmbient != 0
}

// rewrite resolves specifier from fromSource using the tsconfig paths table and
// returns the relative output path. Returns (specifier, false) when the specifier
// is already relative, absolute, or does not match any paths pattern.
func (r *rewriter) rewrite(fromSource string, specifier string) (string, bool) {
  if specifier == "" || strings.HasPrefix(specifier, ".") || strings.HasPrefix(specifier, "/") {
    return specifier, false
  }
  targetSource, ok := r.resolveSource(specifier)
  if !ok {
    return specifier, false
  }
  fromOut := r.outputPathForSource(fromSource)
  targetOut := r.outputPathForSource(targetSource)
  if fromOut == "" || targetOut == "" {
    return specifier, false
  }
  rel, _ := filepath.Rel(filepath.Dir(fromOut), targetOut)
  rel = filepath.ToSlash(rel)
  if !strings.HasPrefix(rel, ".") {
    rel = "./" + rel
  }
  return rel, true
}

// resolveSource finds the source file that a tsconfig paths specifier
// resolves to. Patterns are pre-sorted into tsc's precedence order, and like
// tsc's tryLoadModuleUsingPaths the resolution commits to the first (best)
// matching pattern: only that pattern's substitution targets are tried, in
// order, with extension and index fallbacks. When none of them names a
// program source the specifier stays unrewritten — falling through to a
// weaker pattern would rewrite at a module the type checker never resolved.
func (r *rewriter) resolveSource(specifier string) (string, bool) {
  for _, pattern := range r.patterns {
    star, ok := matchPattern(pattern.pattern, specifier)
    if !ok {
      continue
    }
    for _, target := range pattern.targets {
      candidate := strings.Replace(target, "*", star, 1)
      resolved := normalizePath(filepath.Join(r.basePath, candidate))
      if source, ok := r.lookupSource(resolved); ok {
        return source, true
      }
    }
    return "", false
  }
  return "", false
}

// lookupSource checks whether candidate (a normalized path, possibly without
// extension) corresponds to a known source file. It tries the exact path, stem
// with each known TypeScript/JavaScript source extension, and index files.
func (r *rewriter) lookupSource(candidate string) (string, bool) {
  if source, ok := r.sourceFiles[normalizePath(candidate)]; ok {
    return source, true
  }
  stem := stripKnownSourceExtension(normalizePath(candidate))
  for _, ext := range sourceLookupExtensions {
    if source, ok := r.sourceFiles[stem+ext]; ok {
      return source, true
    }
  }
  for _, ext := range sourceLookupExtensions {
    if source, ok := r.sourceFiles[normalizePath(filepath.Join(stem, "index"+ext))]; ok {
      return source, true
    }
  }
  return "", false
}

// outputPathForSource maps a source file path to its emitted output path under
// outDir, swapping the source extension for the appropriate JS extension. Returns
// "" when outDir or rootDir is unset, or when source is outside rootDir.
func (r *rewriter) outputPathForSource(source string) string {
  if r.outDir == "" || r.rootDir == "" {
    return ""
  }
  rel, err := filepath.Rel(r.rootDir, source)
  if err != nil || isOutsideRelativePath(rel) {
    return ""
  }
  return normalizePath(filepath.Join(r.outDir, replaceSourceExtension(rel, emittedExtension(rel, r.jsxPreserve))))
}

// emittedExtension returns the output-file extension that TypeScript-Go writes
// for a given Program source. TypeScript/JavaScript-family sources are
// transpiled to the matching JavaScript runtime extension. Non-transpiled
// assets that the compiler copies verbatim — such as `.json` sources pulled in
// by resolveJsonModule — keep their original extension, so a rewritten
// specifier names the file the compiler actually emits instead of an invented
// `.js` sibling that never exists on disk.
func emittedExtension(source string, jsxPreserve bool) string {
  ext := filepath.Ext(source)
  switch strings.ToLower(ext) {
  case ".ts", ".js":
    return ".js"
  case ".mts", ".mjs":
    return ".mjs"
  case ".cts", ".cjs":
    return ".cjs"
  case ".tsx", ".jsx":
    if jsxPreserve {
      return ".jsx"
    }
    return ".js"
  default:
    return ext
  }
}

// matchPattern matches specifier against a tsconfig paths pattern (which may
// contain at most one "*" wildcard). Returns the captured wildcard segment and
// true on a match, or ("", false) otherwise. Exact patterns are matched with
// simple equality. The length guard mirrors tsc's isPatternMatch: a specifier
// shorter than the pattern's literal halves combined can still satisfy both
// the prefix and suffix probes ("@lib/x" against "@lib/x*x"), and slicing the
// star capture out of it would panic on inverted bounds.
func matchPattern(pattern string, specifier string) (string, bool) {
  if !strings.Contains(pattern, "*") {
    return "", pattern == specifier
  }
  parts := strings.SplitN(pattern, "*", 2)
  if strings.Contains(parts[1], "*") {
    // More than one wildcard is not a pattern at all in tsc
    // (TryParsePattern discards it), so it must never match here either.
    return "", false
  }
  if len(specifier) < len(parts[0])+len(parts[1]) ||
    !strings.HasPrefix(specifier, parts[0]) ||
    !strings.HasSuffix(specifier, parts[1]) {
    return "", false
  }
  return specifier[len(parts[0]) : len(specifier)-len(parts[1])], true
}

// orderPatterns sorts patterns in place into tsc's matchPatternOrExact
// precedence: exact patterns (no wildcard) first, then wildcard patterns by
// decreasing literal-prefix length. Ranking by total literal length instead
// would steer a specifier at a long-suffix pattern ("*-styles") even though
// tsc resolves it through the longer prefix ("@app/*"), making the rewriter
// disagree with the type checker's own module resolution. Ties keep the
// tsconfig's declaration order, matching tsc's first-longest-prefix-wins scan.
func orderPatterns(patterns []pathPattern) {
  sort.SliceStable(patterns, func(i, j int) bool {
    a, b := patterns[i].pattern, patterns[j].pattern
    aExact, bExact := !strings.Contains(a, "*"), !strings.Contains(b, "*")
    if aExact != bExact {
      return aExact
    }
    return patternPrefixLength(a) > patternPrefixLength(b)
  })
}

// patternPrefixLength returns the length of the literal text before the "*"
// wildcard, or the whole pattern length for exact patterns.
func patternPrefixLength(pattern string) int {
  if i := strings.IndexByte(pattern, '*'); i >= 0 {
    return i
  }
  return len(pattern)
}

// optionalPath resolves value as a path relative to cwd when it is non-empty
// and not already absolute. Returns "" when value is empty.
func optionalPath(value string, cwd string) string {
  if value == "" {
    return ""
  }
  if filepath.IsAbs(value) {
    return normalizePath(value)
  }
  return normalizePath(filepath.Join(cwd, value))
}

// inferredRootDir mirrors TypeScript-Go's GetCommonSourceDirectory fallback
// chain for a project without an explicit rootDir: the tsconfig's directory
// when the program was loaded from one, else the deepest directory shared by
// every input file. The rewriter must anchor output paths exactly where tsgo
// anchors its own emit, or the rewritten specifiers drift from the real
// output layout.
func inferredRootDir(configFilePath string, fileNames []string, currentDirectory string, useCaseSensitiveFileNames bool) string {
  if configFilePath != "" {
    return normalizePath(filepath.Dir(configFilePath))
  }
  return commonSourceDir(fileNames, currentDirectory, useCaseSensitiveFileNames)
}

// commonSourceDir mirrors TypeScript-Go's
// computeCommonSourceDirectoryOfFilenames: the deepest directory shared by
// every file, intersected per normalized path component under the host's case
// sensitivity. Returns "" when the files share no root at all — on Windows, a
// `files` list spanning two volumes — so the caller skips output mapping
// instead of guessing. The previous byte-oriented walk hung there (#310):
// once the shared prefix shrank to a volume root, filepath.Dir handed back
// the backslash form ("C:\") while the termination guard compared it against
// the slash-normalized cursor ("C:/"), re-normalizing the same directory
// forever.
func commonSourceDir(fileNames []string, currentDirectory string, useCaseSensitiveFileNames bool) string {
  var common []string
  for _, fileName := range fileNames {
    components := shimtspath.GetNormalizedPathComponents(fileName, currentDirectory)
    // The base file name is not part of the common directory path.
    components = components[:len(components)-1]
    if common == nil {
      common = components
      continue
    }
    shared := 0
    limit := min(len(common), len(components))
    for shared < limit &&
      shimtspath.GetCanonicalFileName(common[shared], useCaseSensitiveFileNames) ==
        shimtspath.GetCanonicalFileName(components[shared], useCaseSensitiveFileNames) {
      shared++
    }
    if shared == 0 {
      return ""
    }
    common = common[:shared]
  }
  if len(common) == 0 {
    return ""
  }
  return shimtspath.GetPathFromPathComponents(common)
}

// normalizePath cleans and converts a file path to forward-slash form.
func normalizePath(value string) string {
  if value == "" {
    return ""
  }
  return filepath.ToSlash(filepath.Clean(value))
}

// stripKnownSourceExtension removes a recognized TypeScript or JavaScript file
// extension from value. Declaration extensions (.d.ts, .d.mts, .d.cts) are
// tried first. Falls back to stripping any extension via filepath.Ext.
func stripKnownSourceExtension(value string) string {
  lower := strings.ToLower(value)
  for _, ext := range []string{".d.ts", ".d.mts", ".d.cts", ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"} {
    if strings.HasSuffix(lower, ext) {
      return value[:len(value)-len(ext)]
    }
  }
  return strings.TrimSuffix(value, filepath.Ext(value))
}

// replaceSourceExtension strips the known source extension from value and
// appends ext, producing the output file name.
func replaceSourceExtension(value string, ext string) string {
  return stripKnownSourceExtension(filepath.ToSlash(value)) + ext
}

// isOutsideRelativePath reports whether a relative path escapes its base
// directory (i.e. starts with "..").
func isOutsideRelativePath(rel string) bool {
  return rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator))
}
