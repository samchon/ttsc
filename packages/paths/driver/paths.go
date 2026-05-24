package paths

import (
  "path/filepath"
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"

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
  options := prog.ParsedConfig.ParsedConfig.CompilerOptions
  out.basePath = filepath.Clean(options.GetPathsBasePath(prog.Host.GetCurrentDirectory()))
  out.jsxPreserve = options.Jsx == shimcore.JsxEmitPreserve
  out.outDir = optionalPath(options.OutDir, prog.Host.GetCurrentDirectory())
  out.rootDir = optionalPath(options.RootDir, prog.Host.GetCurrentDirectory())
  files := prog.SourceFiles()
  if out.rootDir == "" {
    out.rootDir = commonSourceDir(files)
  }
  for _, file := range files {
    name := normalizePath(file.FileName())
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
  sort.SliceStable(out.patterns, func(i, j int) bool {
    return patternRank(out.patterns[i].pattern) > patternRank(out.patterns[j].pattern)
  })
  return out
}

// apply rewrites all module specifiers in file that match a tsconfig paths pattern.
func (r *rewriter) apply(file *shimast.SourceFile) {
  if r == nil || file == nil || len(r.patterns) == 0 {
    return
  }
  visitModuleSpecifiers(file.AsNode(), func(lit *shimast.Node) {
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

// visitModuleSpecifiers recursively walks the AST rooted at node, calling
// visit for every string-literal module specifier it finds. Covered nodes
// include import/export declarations, require() calls, dynamic import()
// expressions, import-equals declarations, and import-type nodes.
func visitModuleSpecifiers(node *shimast.Node, visit func(*shimast.Node)) {
  if node == nil {
    return
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
    if decl != nil {
      visit(decl.Name())
    }
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if isModuleSpecifierCall(call) && call.Arguments != nil && len(call.Arguments.Nodes) > 0 {
      visit(call.Arguments.Nodes[0])
    }
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    visitModuleSpecifiers(child, visit)
    return false
  })
}

// isModuleSpecifierCall reports whether call is a dynamic import() or a
// CommonJS require() expression.
func isModuleSpecifierCall(call *shimast.CallExpression) bool {
  if call == nil || call.Expression == nil {
    return false
  }
  switch call.Expression.Kind {
  case shimast.KindImportKeyword:
    return true
  case shimast.KindIdentifier:
    return call.Expression.Text() == "require"
  default:
    return false
  }
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

// resolveSource finds the source file that a tsconfig paths specifier resolves to.
// It iterates over sorted patterns and, for each match, tries all substitution
// targets (with and without known extensions) including index files.
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
  return normalizePath(filepath.Join(r.outDir, replaceSourceExtension(rel, emittedJavaScriptExtension(rel, r.jsxPreserve))))
}

// emittedJavaScriptExtension returns the JavaScript file extension that TypeScript
// emits for a given source path.
func emittedJavaScriptExtension(source string, jsxPreserve bool) string {
  switch strings.ToLower(filepath.Ext(source)) {
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
    return ".js"
  }
}

// matchPattern matches specifier against a tsconfig paths pattern (which may
// contain at most one "*" wildcard). Returns the captured wildcard segment and
// true on a match, or ("", false) otherwise. Exact patterns are matched with
// simple equality.
func matchPattern(pattern string, specifier string) (string, bool) {
  if !strings.Contains(pattern, "*") {
    return "", pattern == specifier
  }
  parts := strings.SplitN(pattern, "*", 2)
  if !strings.HasPrefix(specifier, parts[0]) || !strings.HasSuffix(specifier, parts[1]) {
    return "", false
  }
  return specifier[len(parts[0]) : len(specifier)-len(parts[1])], true
}

// patternRank returns the length of a tsconfig paths pattern after removing its
// wildcard character. Patterns with a higher rank (longer literal content) are
// preferred when multiple patterns match the same specifier.
func patternRank(pattern string) int {
  return len(strings.ReplaceAll(pattern, "*", ""))
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

// commonSourceDir returns the longest common directory prefix of all file paths
// in files. It is used as rootDir when the tsconfig does not specify one.
// Returns "" when files is empty.
func commonSourceDir(files []*shimast.SourceFile) string {
  if len(files) == 0 {
    return ""
  }
  common := normalizePath(filepath.Dir(files[0].FileName()))
  for _, file := range files[1:] {
    dir := normalizePath(filepath.Dir(file.FileName()))
    for common != "" && !strings.HasPrefix(dir+"/", common+"/") {
      next := filepath.Dir(common)
      if next == common {
        return common
      }
      common = normalizePath(next)
    }
  }
  return common
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
