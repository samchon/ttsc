package utility

import (
  "encoding/json"
  "flag"
  "fmt"
  "os"
  "path/filepath"
  "sort"
  "strings"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type pluginEntry struct {
  Config map[string]any `json:"config"`
  Name   string         `json:"name"`
  Stage  string         `json:"stage"`
}

type hostOptions struct {
  cwd         string
  emit        bool
  noEmit      bool
  outDir      string
  pluginsJSON string
  quiet       bool
  tsconfig    string
  verbose     bool
}

type transformState struct {
  paths *pathsRewriter
  strip *stripRewriter
}

type transformResult struct {
  Diagnostics []any             `json:"diagnostics,omitempty"`
  TypeScript  map[string]string `json:"typescript"`
}

// RunBuild hosts first-party utility transform plugins inside one compiler emit.
func RunBuild(args []string) int {
  opts, ok := parseHostOptions("build", args)
  if !ok {
    return 2
  }
  prog, entries, _, ok := loadUtilityProgram(opts)
  if !ok {
    return 2
  }
  defer prog.Close()
  if opts.noEmit {
    return 0
  }
  if opts.verbose {
    opts.quiet = false
  }
  if !opts.quiet {
    fmt.Fprintf(os.Stdout, "// ttsc utility: plugins=%d emit=%v\n", len(entries), !opts.noEmit)
  }
  var (
    res    *shimcompiler.EmitResult
    eDiags []driver.Diagnostic
    err    error
  )
  res, eDiags, err = prog.EmitAllRaw(nil)
  if err != nil {
    fmt.Fprintf(os.Stderr, "ttsc utility: emit failed: %v\n", err)
    return 3
  }
  for _, d := range eDiags {
    fmt.Fprintln(os.Stderr, "  -", d.String())
  }
  if res != nil && !opts.quiet {
    fmt.Fprintf(os.Stdout, "// ttsc utility: emitted=%d files\n", len(res.EmittedFiles))
  }
  return 0
}

// RunTransform returns the project TypeScript text after source mutations.
func RunTransform(args []string) int {
  opts, ok := parseHostOptions("transform", args)
  if !ok {
    return 2
  }
  prog, _, _, ok := loadUtilityProgram(opts)
  if !ok {
    return 2
  }
  defer prog.Close()
  out := transformResult{TypeScript: map[string]string{}}
  for _, file := range prog.SourceFiles() {
    out.TypeScript[apiOutputKey(opts.cwd, file.FileName())] = file.Text()
  }
  data, err := json.Marshal(out)
  if err != nil {
    fmt.Fprintf(os.Stderr, "ttsc utility: transform marshal failed: %v\n", err)
    return 3
  }
  fmt.Fprintln(os.Stdout, string(data))
  return 0
}

func parseHostOptions(command string, args []string) (hostOptions, bool) {
  fs := flag.NewFlagSet(command, flag.ContinueOnError)
  fs.SetOutput(os.Stderr)
  cwd := fs.String("cwd", "", "project directory")
  emit := fs.Bool("emit", false, "force emit")
  noEmit := fs.Bool("noEmit", false, "force no emit")
  outDir := fs.String("outDir", "", "emit directory override")
  pluginsJSON := fs.String("plugins-json", "", "ttsc plugin manifest JSON")
  quiet := fs.Bool("quiet", true, "suppress summary")
  tsconfig := fs.String("tsconfig", "tsconfig.json", "project tsconfig")
  verbose := fs.Bool("verbose", false, "print summary")
  if err := fs.Parse(args); err != nil {
    return hostOptions{}, false
  }
  resolvedCwd := *cwd
  if resolvedCwd == "" {
    var err error
    resolvedCwd, err = os.Getwd()
    if err != nil {
      fmt.Fprintf(os.Stderr, "ttsc utility: cwd: %v\n", err)
      return hostOptions{}, false
    }
  }
  if !filepath.IsAbs(resolvedCwd) {
    abs, err := filepath.Abs(resolvedCwd)
    if err != nil {
      fmt.Fprintf(os.Stderr, "ttsc utility: cwd: %v\n", err)
      return hostOptions{}, false
    }
    resolvedCwd = abs
  }
  return hostOptions{
    cwd:         filepath.Clean(resolvedCwd),
    emit:        *emit,
    noEmit:      *noEmit,
    outDir:      *outDir,
    pluginsJSON: *pluginsJSON,
    quiet:       *quiet,
    tsconfig:    *tsconfig,
    verbose:     *verbose,
  }, true
}

func loadUtilityProgram(opts hostOptions) (*driver.Program, []pluginEntry, transformState, bool) {
  entries, err := parsePluginEntries(opts.pluginsJSON)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, nil, transformState{}, false
  }
  sourcePreamble, err := prepareSourcePreamble(entries)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, nil, transformState{}, false
  }
  prog, diags, err := driver.LoadProgram(opts.cwd, opts.tsconfig, driver.LoadProgramOptions{
    ForceEmit:      opts.emit,
    ForceNoEmit:    opts.noEmit,
    OutDir:         opts.outDir,
    SourcePreamble: sourcePreamble,
  })
  if err != nil {
    fmt.Fprintf(os.Stderr, "ttsc utility: %v\n", err)
    return nil, nil, transformState{}, false
  }
  if len(diags) > 0 {
    driver.WritePrettyDiagnostics(os.Stderr, diags, opts.cwd)
    return nil, nil, transformState{}, false
  }
  if diags := prog.Diagnostics(); len(diags) > 0 {
    driver.WritePrettyDiagnostics(os.Stderr, diags, opts.cwd)
    return nil, nil, transformState{}, false
  }
  state, err := prepareTransforms(prog, entries)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, nil, transformState{}, false
  }
  if err := applySourceTransforms(prog, state); err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, nil, transformState{}, false
  }
  return prog, entries, state, true
}

func parsePluginEntries(input string) ([]pluginEntry, error) {
  if strings.TrimSpace(input) == "" {
    return nil, nil
  }
  var entries []pluginEntry
  if err := json.Unmarshal([]byte(input), &entries); err != nil {
    return nil, fmt.Errorf("ttsc utility: invalid --plugins-json: %w", err)
  }
  return entries, nil
}

func prepareTransforms(prog *driver.Program, entries []pluginEntry) (transformState, error) {
  state := transformState{}
  for _, entry := range entries {
    switch entry.Name {
    case "@ttsc/paths":
      state.paths = newPathsRewriter(prog)
    case "@ttsc/strip":
      strip, err := parseStrip(entry.Config)
      if err != nil {
        return state, err
      }
      state.strip = strip
    }
  }
  return state, nil
}

func prepareSourcePreamble(entries []pluginEntry) (string, error) {
  var preamble strings.Builder
  for _, entry := range entries {
    if entry.Name != "@ttsc/banner" {
      continue
    }
    banner, err := parseBanner(entry.Config)
    if err != nil {
      return "", err
    }
    preamble.WriteString(banner)
  }
  return preamble.String(), nil
}

func applySourceTransforms(prog *driver.Program, state transformState) error {
  for _, file := range prog.SourceFiles() {
    if state.paths != nil {
      state.paths.apply(file)
    }
    if state.strip != nil {
      state.strip.apply(file)
    }
  }
  return nil
}

func apiOutputKey(cwd, fileName string) string {
  rel, err := filepath.Rel(cwd, fileName)
  if err != nil || strings.HasPrefix(rel, "..") {
    return filepath.ToSlash(fileName)
  }
  return filepath.ToSlash(rel)
}

func parseBanner(config map[string]any) (string, error) {
  raw, ok := config["banner"]
  if !ok {
    return "", fmt.Errorf("@ttsc/banner: \"banner\" must be a non-empty string")
  }
  text, ok := raw.(string)
  if !ok || strings.TrimSpace(text) == "" {
    return "", fmt.Errorf("@ttsc/banner: \"banner\" must be a non-empty string")
  }
  lines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
  for len(lines) > 0 && strings.TrimSpace(lines[len(lines)-1]) == "" {
    lines = lines[:len(lines)-1]
  }
  var b strings.Builder
  sep := strings.Repeat("-", 64)
  b.WriteString("/**\n")
  b.WriteString(" * ")
  b.WriteString(sep)
  b.WriteByte('\n')
  for _, line := range lines {
    b.WriteString(" * ")
    b.WriteString(sanitizeJSDocLine(line))
    b.WriteByte('\n')
  }
  b.WriteString(" *\n")
  b.WriteString(" * @packageDocumentation\n ")
  b.WriteString("*/\n")
  return b.String(), nil
}

func sanitizeJSDocLine(line string) string {
  return strings.ReplaceAll(line, "*/", "* /")
}

type pathsRewriter struct {
  basePath    string
  outDir      string
  patterns    []pathsPattern
  rootDir     string
  sourceFiles map[string]string
}

type pathsPattern struct {
  pattern string
  targets []string
}

func newPathsRewriter(prog *driver.Program) *pathsRewriter {
  out := &pathsRewriter{sourceFiles: map[string]string{}}
  if prog == nil || prog.ParsedConfig == nil || prog.ParsedConfig.ParsedConfig == nil || prog.ParsedConfig.ParsedConfig.CompilerOptions == nil {
    return out
  }
  options := prog.ParsedConfig.ParsedConfig.CompilerOptions
  out.basePath = filepath.Clean(options.GetPathsBasePath(prog.Host.GetCurrentDirectory()))
  out.outDir = optionalPath(options.OutDir, prog.Host.GetCurrentDirectory())
  out.rootDir = optionalPath(options.RootDir, prog.Host.GetCurrentDirectory())
  files := prog.SourceFiles()
  if out.rootDir == "" {
    out.rootDir = commonSourceDir(files)
  }
  for _, file := range files {
    name := normalizePath(file.FileName())
    out.sourceFiles[name] = name
    out.sourceFiles[stripKnownSourceExtension(name)] = name
  }
  if options.Paths != nil {
    for pattern, targets := range options.Paths.Entries() {
      out.patterns = append(out.patterns, pathsPattern{
        pattern: pattern,
        targets: append([]string(nil), targets...),
      })
    }
  }
  sort.SliceStable(out.patterns, func(i, j int) bool {
    return patternRank(out.patterns[i].pattern) > patternRank(out.patterns[j].pattern)
  })
  return out
}

func (r *pathsRewriter) apply(file *shimast.SourceFile) {
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
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if call.Expression != nil && call.Expression.Kind == shimast.KindImportKeyword && call.Arguments != nil && len(call.Arguments.Nodes) > 0 {
      visit(call.Arguments.Nodes[0])
    }
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    visitModuleSpecifiers(child, visit)
    return false
  })
}

func (r *pathsRewriter) rewrite(fromSource string, specifier string) (string, bool) {
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
  rel, err := filepath.Rel(filepath.Dir(fromOut), targetOut)
  if err != nil {
    return specifier, false
  }
  rel = filepath.ToSlash(rel)
  if !strings.HasPrefix(rel, ".") {
    rel = "./" + rel
  }
  return rel, true
}

func (r *pathsRewriter) resolveSource(specifier string) (string, bool) {
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

func (r *pathsRewriter) lookupSource(candidate string) (string, bool) {
  if source, ok := r.sourceFiles[normalizePath(candidate)]; ok {
    return source, true
  }
  stem := stripKnownSourceExtension(normalizePath(candidate))
  if source, ok := r.sourceFiles[stem]; ok {
    return source, true
  }
  for _, ext := range []string{".ts", ".tsx", ".mts", ".cts"} {
    if source, ok := r.sourceFiles[stem+ext]; ok {
      return source, true
    }
  }
  return "", false
}

func (r *pathsRewriter) outputPathForSource(source string) string {
  if r.outDir == "" || r.rootDir == "" {
    return ""
  }
  rel, err := filepath.Rel(r.rootDir, source)
  if err != nil || strings.HasPrefix(rel, "..") {
    return ""
  }
  return normalizePath(filepath.Join(r.outDir, replaceSourceExtension(rel, ".js")))
}

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

func patternRank(pattern string) int {
  return len(strings.ReplaceAll(pattern, "*", ""))
}

func optionalPath(value string, cwd string) string {
  if value == "" {
    return ""
  }
  if filepath.IsAbs(value) {
    return normalizePath(value)
  }
  return normalizePath(filepath.Join(cwd, value))
}

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

func normalizePath(value string) string {
  if value == "" {
    return ""
  }
  return filepath.ToSlash(filepath.Clean(value))
}

func stripKnownSourceExtension(value string) string {
  lower := strings.ToLower(value)
  for _, ext := range []string{".d.ts", ".d.mts", ".d.cts", ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"} {
    if strings.HasSuffix(lower, ext) {
      return value[:len(value)-len(ext)]
    }
  }
  return strings.TrimSuffix(value, filepath.Ext(value))
}

func replaceSourceExtension(value string, ext string) string {
  return stripKnownSourceExtension(filepath.ToSlash(value)) + ext
}

type stripRewriter struct {
  calls         []callPattern
  stripDebugger bool
}

type callPattern struct {
  parts    []string
  wildcard bool
}

func parseStrip(config map[string]any) (*stripRewriter, error) {
  calls, err := stringArrayConfig(config, "calls")
  if err != nil {
    return nil, fmt.Errorf("@ttsc/strip: %w", err)
  }
  statements, err := stringArrayConfig(config, "statements")
  if err != nil {
    return nil, fmt.Errorf("@ttsc/strip: %w", err)
  }
  out := &stripRewriter{}
  for _, call := range calls {
    pattern, err := parseCallPattern(call)
    if err != nil {
      return nil, fmt.Errorf("@ttsc/strip: %w", err)
    }
    out.calls = append(out.calls, pattern)
  }
  for _, statement := range statements {
    switch statement {
    case "debugger":
      out.stripDebugger = true
    default:
      return nil, fmt.Errorf("@ttsc/strip: unsupported statement pattern %q", statement)
    }
  }
  return out, nil
}

func (s *stripRewriter) apply(file *shimast.SourceFile) {
  if s == nil || file == nil || (len(s.calls) == 0 && !s.stripDebugger) {
    return
  }
  filterStatements(file.Statements, s)
}

func filterStatements(list *shimast.NodeList, strip *stripRewriter) {
  if list == nil || len(list.Nodes) == 0 {
    return
  }
  out := list.Nodes[:0]
  for _, stmt := range list.Nodes {
    if shouldStripStatement(stmt, strip) {
      continue
    }
    filterChildStatements(stmt, strip)
    out = append(out, stmt)
  }
  list.Nodes = out
}

func filterChildStatements(node *shimast.Node, strip *stripRewriter) {
  if node == nil {
    return
  }
  if node.CanHaveStatements() {
    filterStatements(node.StatementList(), strip)
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    filterChildStatements(child, strip)
    return false
  })
}

func shouldStripStatement(node *shimast.Node, strip *stripRewriter) bool {
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindDebuggerStatement:
    return strip.stripDebugger
  case shimast.KindExpressionStatement:
    expr := node.AsExpressionStatement().Expression
    name, ok := callExpressionName(expr)
    return ok && strip.matchesCall(name)
  default:
    return false
  }
}

func (s *stripRewriter) matchesCall(name string) bool {
  for _, pattern := range s.calls {
    if pattern.matches(name) {
      return true
    }
  }
  return false
}

func parseCallPattern(text string) (callPattern, error) {
  parts := strings.Split(text, ".")
  if len(parts) == 0 {
    return callPattern{}, fmt.Errorf("empty call pattern")
  }
  for i, part := range parts {
    if part == "" {
      return callPattern{}, fmt.Errorf("invalid call pattern %q", text)
    }
    if part == "*" && i != len(parts)-1 {
      return callPattern{}, fmt.Errorf("wildcard is only supported at the end of call pattern %q", text)
    }
  }
  wildcard := parts[len(parts)-1] == "*"
  if wildcard {
    parts = parts[:len(parts)-1]
  }
  return callPattern{parts: parts, wildcard: wildcard}, nil
}

func (p callPattern) matches(name string) bool {
  parts := strings.Split(name, ".")
  if p.wildcard {
    if len(parts) <= len(p.parts) {
      return false
    }
    return equalStringSlices(parts[:len(p.parts)], p.parts)
  }
  return equalStringSlices(parts, p.parts)
}

func callExpressionName(expr *shimast.Node) (string, bool) {
  if expr == nil || expr.Kind != shimast.KindCallExpression {
    return "", false
  }
  call := expr.AsCallExpression()
  return dottedName(call.Expression)
}

func dottedName(expr *shimast.Node) (string, bool) {
  if expr == nil {
    return "", false
  }
  switch expr.Kind {
  case shimast.KindIdentifier:
    return expr.Text(), true
  case shimast.KindPropertyAccessExpression:
    prop := expr.AsPropertyAccessExpression()
    left, ok := dottedName(prop.Expression)
    if !ok || prop.Name() == nil {
      return "", false
    }
    return left + "." + prop.Name().Text(), true
  default:
    return "", false
  }
}

func stringArrayConfig(config map[string]any, key string) ([]string, error) {
  raw, ok := config[key]
  if !ok || raw == nil {
    return nil, nil
  }
  values, ok := raw.([]any)
  if !ok {
    return nil, fmt.Errorf("%q must be an array of strings", key)
  }
  out := make([]string, 0, len(values))
  for i, value := range values {
    text, ok := value.(string)
    if !ok || strings.TrimSpace(text) == "" {
      return nil, fmt.Errorf("%q[%d] must be a non-empty string", key, i)
    }
    out = append(out, text)
  }
  return out, nil
}

func equalStringSlices(left, right []string) bool {
  if len(left) != len(right) {
    return false
  }
  for i := range left {
    if left[i] != right[i] {
      return false
    }
  }
  return true
}
