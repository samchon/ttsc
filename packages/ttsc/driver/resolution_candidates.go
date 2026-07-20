package driver

import (
  "bytes"
  "encoding/json"
  "os"
  "path/filepath"
  "strings"

  "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  "github.com/microsoft/typescript-go/shim/tsoptions"
)

// ModuleResolutionContext carries the exact TypeScript-Go configuration for a
// module-specifier lookup. Candidate discovery must share its mode and package
// resolution switches, otherwise a path the compiler cannot select becomes an
// accidental freshness input.
type ModuleResolutionContext struct {
  Options *shimcore.CompilerOptions
  Mode    shimcore.ResolutionMode
}

// SupersedingModuleCandidates returns, per source-file envelope key, the
// resolution candidates strictly ahead of each module target the loaded
// program selected. A missing member can therefore become a freshness input
// without making the whole resolution search (including lower-priority paths)
// an invalidation input.
//
// Candidate enumeration is host-owned. It mirrors the resident graph session's
// speculation for relative modules, paths, rootDirs, package imports/exports,
// and node_modules ancestry, while the compiler itself remains the authority
// that says which target won. The returned values use TransformOutputKey so
// they travel in the same envelope vocabulary as graph edges.
func SupersedingModuleCandidates(prog *Program, cwd string) map[string][]string {
  if prog == nil || prog.TSProgram == nil || prog.ParsedConfig == nil {
    return nil
  }
  configs := []*tsoptions.ParsedCommandLine{prog.ParsedConfig}
  output := map[string][]string{}
  caseSensitive := true
  if prog.FS != nil {
    caseSensitive = prog.FS.UseCaseSensitiveFileNames()
  }
  for _, source := range prog.TSProgram.SourceFiles() {
    if source == nil || strings.HasPrefix(source.FileName(), bundledScheme) {
      continue
    }
    key := TransformOutputKey(cwd, source.FileName())
    directory := filepath.Dir(source.FileName())
    for _, specifier := range SourceModuleSpecifiers(source) {
      context := moduleResolutionContextFor(configs, prog.TSProgram.GetModeForUsageLocation(source, specifier))
      resolved := prog.TSProgram.GetResolvedModuleFromModuleSpecifier(source, specifier)
      if resolved == nil || !resolved.IsResolved() {
        continue
      }
      before := ModuleResolutionPredecessors(
        configs,
        directory,
        cwd,
        specifier.Text(),
        resolved.ResolvedFileName,
        caseSensitive,
        context,
      )
      for _, candidate := range before {
        output[key] = append(output[key], TransformOutputKey(cwd, candidate))
      }
    }
  }
  for source, candidates := range output {
    output[source] = compactStringsInOrder(candidates)
  }
  return output
}

// ModuleResolutionPredecessors returns the paths in the host-owned candidate
// search that precede resolvedFileName. An unresolved specifier keeps the full
// candidate list through ModuleResolutionCandidates; a resolved specifier must
// not track a lower-priority path because creating it cannot alter resolution.
func ModuleResolutionPredecessors(
  configs []*tsoptions.ParsedCommandLine,
  directory, cwd, specifier, resolvedFileName string,
  caseSensitive bool,
  context ModuleResolutionContext,
) []string {
  candidates := ModuleResolutionCandidates(configs, directory, cwd, specifier, context)
  output := make([]string, 0, len(candidates))
  for _, candidate := range candidates {
    if sameCandidatePath(candidate, resolvedFileName, caseSensitive) {
      return compactStringsInOrder(output)
    }
    output = append(output, candidate)
  }
  // Never widen freshness to candidates whose precedence relative to the
  // compiler's selected target we could not prove. A symlink-rewritten or
  // otherwise non-enumerated winner remains covered by its realized graph edge.
  return nil
}

func moduleResolutionContextFor(configs []*tsoptions.ParsedCommandLine, mode shimcore.ResolutionMode) ModuleResolutionContext {
  context := ModuleResolutionContext{Mode: mode}
  for _, parsed := range configs {
    if parsed != nil && parsed.ParsedConfig != nil && parsed.ParsedConfig.CompilerOptions != nil {
      context.Options = parsed.ParsedConfig.CompilerOptions
      break
    }
  }
  return context
}

func (context ModuleResolutionContext) isESM() bool {
  return context.Mode == shimcore.ResolutionModeESM
}

func (context ModuleResolutionContext) moduleResolutionKind() shimcore.ModuleResolutionKind {
  if context.Options == nil {
    return shimcore.ModuleResolutionKindBundler
  }
  return context.Options.GetModuleResolutionKind()
}

func (context ModuleResolutionContext) usesPackageExports() bool {
  switch context.moduleResolutionKind() {
  case shimcore.ModuleResolutionKindNode16, shimcore.ModuleResolutionKindNodeNext:
    return true
  case shimcore.ModuleResolutionKindBundler:
    return context.Options == nil || context.Options.GetResolvePackageJsonExports()
  default:
    return false
  }
}

func (context ModuleResolutionContext) usesPackageImports() bool {
  switch context.moduleResolutionKind() {
  case shimcore.ModuleResolutionKindNode16, shimcore.ModuleResolutionKindNodeNext:
    return true
  case shimcore.ModuleResolutionKindBundler:
    return context.Options == nil || context.Options.GetResolvePackageJsonImports()
  default:
    return false
  }
}

func (context ModuleResolutionContext) packageConditions() map[string]struct{} {
  if context.Options == nil {
    return map[string]struct{}{"require": {}, "types": {}}
  }
  mode := context.Mode
  if mode == shimcore.ResolutionModeNone && context.moduleResolutionKind() == shimcore.ModuleResolutionKindBundler {
    mode = shimcore.ResolutionModeESM
  }
  conditions := map[string]struct{}{}
  if mode == shimcore.ResolutionModeESM {
    conditions["import"] = struct{}{}
  } else {
    conditions["require"] = struct{}{}
  }
  if context.Options.NoDtsResolution != shimcore.TSTrue {
    conditions["types"] = struct{}{}
  }
  if context.moduleResolutionKind() != shimcore.ModuleResolutionKindBundler {
    conditions["node"] = struct{}{}
  }
  for _, condition := range context.Options.CustomConditions {
    conditions[condition] = struct{}{}
  }
  return conditions
}

func sameCandidatePath(left, right string, caseSensitive bool) bool {
  left = filepath.Clean(left)
  right = filepath.Clean(right)
  if caseSensitive {
    return left == right
  }
  return strings.EqualFold(left, right)
}

// FileCandidates lists the ordered file and directory probes for base. The
// suffix family follows the module specifier's explicit extension, matching the
// resolver's extension branch instead of treating every source kind as a
// possible predecessor.
func FileCandidates(base string) []string {
  base, suffixes := fileCandidateBaseAndSuffixes(base)
  candidates := []string{}
  for _, suffix := range suffixes {
    candidates = append(candidates, base+suffix)
  }
  candidates = append(candidates, filepath.Join(base, "package.json"))
  for _, suffix := range suffixes {
    candidates = append(candidates, filepath.Join(base, "index"+suffix))
  }
  return candidates
}

func moduleFileCandidates(base string, context ModuleResolutionContext, includeDirectory bool) []string {
  explicitExtension := filepath.Ext(base)
  base, suffixes := fileCandidateBaseAndSuffixes(base)
  if context.Options != nil && context.Options.NoDtsResolution == shimcore.TSTrue {
    suffixes = withoutDeclarationSuffixes(suffixes)
  }
  if context.isESM() && explicitExtension == "" {
    return nil
  }
  candidates := []string{}
  for _, suffix := range suffixes {
    candidates = append(candidates, moduleSuffixCandidates(base+suffix, context)...)
  }
  if !includeDirectory || context.isESM() {
    return candidates
  }
  candidates = append(candidates, filepath.Join(base, "package.json"))
  for _, suffix := range suffixes {
    candidates = append(candidates, moduleSuffixCandidates(filepath.Join(base, "index"+suffix), context)...)
  }
  return candidates
}

func withoutDeclarationSuffixes(suffixes []string) []string {
  output := make([]string, 0, len(suffixes))
  for _, suffix := range suffixes {
    if !strings.HasPrefix(suffix, ".d.") {
      output = append(output, suffix)
    }
  }
  return output
}

func moduleSuffixCandidates(path string, context ModuleResolutionContext) []string {
  if context.Options == nil || len(context.Options.ModuleSuffixes) == 0 {
    return []string{path}
  }
  extension := filepath.Ext(path)
  base := strings.TrimSuffix(path, extension)
  candidates := make([]string, 0, len(context.Options.ModuleSuffixes))
  for _, suffix := range context.Options.ModuleSuffixes {
    candidates = append(candidates, base+suffix+extension)
  }
  return candidates
}

func fileCandidateBaseAndSuffixes(base string) (string, []string) {
  lower := strings.ToLower(base)
  switch {
  case strings.HasSuffix(lower, ".d.mts"):
    return base[:len(base)-len(".d.mts")], []string{".mts", ".d.mts", ".mjs"}
  case strings.HasSuffix(lower, ".mjs"), strings.HasSuffix(lower, ".mts"):
    return base[:len(base)-len(filepath.Ext(base))], []string{".mts", ".d.mts", ".mjs"}
  case strings.HasSuffix(lower, ".d.cts"):
    return base[:len(base)-len(".d.cts")], []string{".cts", ".d.cts", ".cjs"}
  case strings.HasSuffix(lower, ".cjs"), strings.HasSuffix(lower, ".cts"):
    return base[:len(base)-len(filepath.Ext(base))], []string{".cts", ".d.cts", ".cjs"}
  case strings.HasSuffix(lower, ".tsx"), strings.HasSuffix(lower, ".jsx"):
    return base[:len(base)-len(filepath.Ext(base))], []string{".tsx", ".ts", ".d.ts", ".jsx", ".js"}
  case strings.HasSuffix(lower, ".d.ts"):
    return base[:len(base)-len(".d.ts")], []string{".ts", ".tsx", ".d.ts", ".js", ".jsx"}
  case strings.HasSuffix(lower, ".ts"), strings.HasSuffix(lower, ".js"):
    return base[:len(base)-len(filepath.Ext(base))], []string{".ts", ".tsx", ".d.ts", ".js", ".jsx"}
  default:
    return base, []string{".ts", ".tsx", ".d.ts", ".js", ".jsx"}
  }
}

// TypeReferenceCandidates lists the probes used for a triple-slash type
// directive or compilerOptions.types entry.
func TypeReferenceCandidates(configs []*tsoptions.ParsedCommandLine, directory, cwd, name string) []string {
  candidates := []string{}
  for _, parsed := range configs {
    if parsed == nil || parsed.ParsedConfig == nil || parsed.ParsedConfig.CompilerOptions == nil {
      continue
    }
    for _, root := range parsed.ParsedConfig.CompilerOptions.TypeRoots {
      candidates = append(candidates, FileCandidates(filepath.Join(root, filepath.FromSlash(name)))...)
    }
  }
  for current := filepath.Clean(directory); ; current = filepath.Dir(current) {
    candidates = append(candidates, FileCandidates(filepath.Join(current, "node_modules", "@types", filepath.FromSlash(name)))...)
    if current == filepath.Clean(cwd) || filepath.Dir(current) == current {
      return candidates
    }
  }
}

// ModuleResolutionCandidates lists the bounded speculative probes for one
// module specifier in compiler precedence order. The list is used unchanged for
// unresolved specifiers and is cut at the compiler-selected target for resolved
// specifiers by ModuleResolutionPredecessors.
func ModuleResolutionCandidates(configs []*tsoptions.ParsedCommandLine, directory, cwd, specifier string, context ModuleResolutionContext) []string {
  if specifier == "" {
    return nil
  }
  if strings.HasPrefix(specifier, ".") {
    candidates := moduleFileCandidates(filepath.Clean(filepath.Join(directory, filepath.FromSlash(specifier))), context, true)
    return append(candidates, rootDirsCandidates(configs, directory, specifier, context)...)
  }
  candidates := compilerOptionCandidates(configs, specifier, context)
  if strings.HasPrefix(specifier, "#") {
    if !context.usesPackageImports() {
      return candidates
    }
    for current := filepath.Clean(directory); ; current = filepath.Dir(current) {
      fromManifest, _ := packageManifestCandidates(current, specifier, context)
      candidates = append(candidates, fromManifest...)
      if current == filepath.Clean(cwd) || filepath.Dir(current) == current {
        return candidates
      }
    }
  }
  for current := filepath.Clean(directory); ; current = filepath.Dir(current) {
    base := filepath.Join(current, "node_modules", filepath.FromSlash(specifier))
    root := packageRoot(base, specifier)
    fromManifest, hasExports := packageManifestCandidates(root, packageSubpath(specifier), context)
    // Package exports block bare file and folder lookups. Recording them would
    // make a file that TypeScript will never select invalidate a resident
    // snapshot, so only the export-map paths participate in this branch.
    if !hasExports {
      candidates = append(candidates, moduleFileCandidates(base, context, true)...)
    }
    candidates = append(candidates, filepath.Join(root, "package.json"))
    candidates = append(candidates, fromManifest...)
    if current == filepath.Clean(cwd) || filepath.Dir(current) == current {
      break
    }
  }
  return candidates
}

// SourceModuleSpecifiers returns all static and dynamic module-specifier
// literals a source file carries, including imports, exports, import-equals,
// import types, require calls, and dynamic imports.
func SourceModuleSpecifiers(source *ast.SourceFile) []*ast.Node {
  if source == nil {
    return nil
  }
  specifiers := []*ast.Node{}
  var walk func(*ast.Node) bool
  walk = func(node *ast.Node) bool {
    if node == nil {
      return false
    }
    var specifier *ast.Node
    switch node.Kind {
    case ast.KindImportDeclaration, ast.KindJSImportDeclaration:
      specifier = node.AsImportDeclaration().ModuleSpecifier
    case ast.KindExportDeclaration:
      specifier = node.AsExportDeclaration().ModuleSpecifier
    case ast.KindImportEqualsDeclaration:
      reference := node.AsImportEqualsDeclaration().ModuleReference
      if reference != nil && reference.Kind == ast.KindExternalModuleReference {
        specifier = reference.AsExternalModuleReference().Expression
      }
    case ast.KindImportType:
      argument := node.AsImportTypeNode().Argument
      if argument != nil && argument.Kind == ast.KindLiteralType {
        specifier = argument.AsLiteralTypeNode().Literal
      }
    case ast.KindCallExpression:
      call := node.AsCallExpression()
      if isModuleSpecifierCall(call) && call.Arguments != nil && len(call.Arguments.Nodes) > 0 {
        specifier = call.Arguments.Nodes[0]
      }
    }
    if specifier != nil && (specifier.Kind == ast.KindStringLiteral || specifier.Kind == ast.KindNoSubstitutionTemplateLiteral) {
      specifiers = append(specifiers, specifier)
    }
    node.ForEachChild(walk)
    return false
  }
  walk(source.AsNode())
  return specifiers
}

func isModuleSpecifierCall(call *ast.CallExpression) bool {
  if call == nil || call.Expression == nil {
    return false
  }
  if call.Expression.Kind == ast.KindImportKeyword {
    return true
  }
  return call.Expression.Kind == ast.KindIdentifier && call.Expression.Text() == "require"
}

type packageTarget struct {
  path         string
  wildcard     string
  packageEntry bool
  usesCommonJS bool
}

// packageValue preserves a package.json object's declaration order. That order
// is resolution semantics for conditional exports/imports, so decoding into a
// Go map would make the speculative prefix nondeterministic.
type packageValue struct {
  array  []packageValue
  object []packageProperty
  text   *string
}

type packageProperty struct {
  key   string
  value packageValue
}

func packageManifestCandidates(root, wildcard string, context ModuleResolutionContext) ([]string, bool) {
  content, err := os.ReadFile(filepath.Join(root, "package.json"))
  if err != nil {
    return nil, false
  }
  var manifest struct {
    Main          string          `json:"main"`
    Module        string          `json:"module"`
    Types         string          `json:"types"`
    Typings       string          `json:"typings"`
    Exports       json.RawMessage `json:"exports"`
    Imports       json.RawMessage `json:"imports"`
    Type          string          `json:"type"`
    TypesVersions json.RawMessage `json:"typesVersions"`
  }
  if json.Unmarshal(content, &manifest) != nil {
    return nil, false
  }
  defaultWildcard := strings.TrimPrefix(strings.TrimPrefix(wildcard, "./"), "#")
  targets := []packageTarget{}
  if strings.HasPrefix(wildcard, "#") {
    if context.usesPackageImports() {
      if value, ok := decodePackageValue(manifest.Imports); ok {
        collectPackageMappingTargets(value, wildcard, defaultWildcard, context.packageConditions(), &targets)
      }
    }
    return packageTargetCandidates(root, targets, context), false
  }
  exportRequest := "."
  if wildcard != "" && !strings.HasPrefix(wildcard, "#") {
    exportRequest = "./" + strings.TrimPrefix(wildcard, "./")
  }
  exports, hasExports := decodePackageValue(manifest.Exports)
  if hasExports && context.usesPackageExports() {
    collectPackageMappingTargets(exports, exportRequest, defaultWildcard, context.packageConditions(), &targets)
  } else {
    hasExports = false
    if value, ok := decodePackageValue(manifest.TypesVersions); ok {
      collectPackageTargets(value, defaultWildcard, nil, &targets)
    }
    // `typings`, `types`, and `main` are directory-entrypoint fields. A
    // subpath resolution never falls back to them, and `module` is not a
    // TypeScript-Go resolution field at all.
    if wildcard == "" {
      usesCommonJS := manifest.Type != "module"
      if context.Options == nil || context.Options.NoDtsResolution != shimcore.TSTrue {
        targets = append(targets,
          packageTarget{path: manifest.Typings, wildcard: defaultWildcard, packageEntry: true, usesCommonJS: usesCommonJS},
          packageTarget{path: manifest.Types, wildcard: defaultWildcard, packageEntry: true, usesCommonJS: usesCommonJS},
        )
      }
      targets = append(targets, packageTarget{path: manifest.Main, wildcard: defaultWildcard, packageEntry: true, usesCommonJS: usesCommonJS})
    }
  }
  return packageTargetCandidates(root, targets, context), hasExports
}

func packageTargetCandidates(root string, targets []packageTarget, context ModuleResolutionContext) []string {
  candidates := []string{}
  for _, target := range targets {
    if target.path == "" || filepath.IsAbs(target.path) || strings.Contains(target.path, "://") {
      continue
    }
    targetPath := strings.Replace(target.path, "*", target.wildcard, 1)
    targetContext := context
    if target.packageEntry && target.usesCommonJS {
      targetContext.Mode = shimcore.ResolutionModeCommonJS
    }
    candidates = append(candidates, moduleFileCandidates(filepath.Join(root, filepath.FromSlash(targetPath)), targetContext, target.packageEntry)...)
  }
  return candidates
}

func collectPackageMappingTargets(value packageValue, request, wildcard string, conditions map[string]struct{}, targets *[]packageTarget) {
  if value.object != nil {
    mapping := false
    for _, property := range value.object {
      if strings.HasPrefix(property.key, ".") || strings.HasPrefix(property.key, "#") {
        mapping = true
        break
      }
    }
    if mapping {
      property, matched, ok := matchingPackageProperty(value.object, request)
      if ok {
        collectPackageTargets(property.value, matched, conditions, targets)
      }
      return
    }
  }
  collectPackageTargets(value, wildcard, conditions, targets)
}

func collectPackageTargets(value packageValue, wildcard string, conditions map[string]struct{}, targets *[]packageTarget) {
  if value.text != nil {
    *targets = append(*targets, packageTarget{path: *value.text, wildcard: wildcard})
    return
  }
  for _, child := range value.array {
    collectPackageTargets(child, wildcard, conditions, targets)
  }
  for _, property := range value.object {
    if conditions == nil {
      collectPackageTargets(property.value, wildcard, nil, targets)
      continue
    }
    if property.key == "default" {
      collectPackageTargets(property.value, wildcard, conditions, targets)
      continue
    }
    if _, active := conditions[property.key]; active {
      collectPackageTargets(property.value, wildcard, conditions, targets)
    }
  }
}

func decodePackageValue(raw json.RawMessage) (packageValue, bool) {
  trimmed := bytes.TrimSpace(raw)
  if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
    return packageValue{}, false
  }
  switch trimmed[0] {
  case '"':
    var text string
    if json.Unmarshal(trimmed, &text) != nil {
      return packageValue{}, false
    }
    return packageValue{text: &text}, true
  case '[':
    var rawChildren []json.RawMessage
    if json.Unmarshal(trimmed, &rawChildren) != nil {
      return packageValue{}, false
    }
    value := packageValue{array: make([]packageValue, 0, len(rawChildren))}
    for _, child := range rawChildren {
      parsed, ok := decodePackageValue(child)
      if ok {
        value.array = append(value.array, parsed)
      }
    }
    return value, true
  case '{':
    decoder := json.NewDecoder(bytes.NewReader(trimmed))
    if _, err := decoder.Token(); err != nil {
      return packageValue{}, false
    }
    value := packageValue{}
    for decoder.More() {
      token, err := decoder.Token()
      key, keyOK := token.(string)
      if err != nil || !keyOK {
        return packageValue{}, false
      }
      var child json.RawMessage
      if decoder.Decode(&child) != nil {
        return packageValue{}, false
      }
      parsed, ok := decodePackageValue(child)
      if ok {
        value.object = append(value.object, packageProperty{key: key, value: parsed})
      }
    }
    if _, err := decoder.Token(); err != nil {
      return packageValue{}, false
    }
    return value, true
  default:
    return packageValue{}, false
  }
}

func packageSubpath(specifier string) string {
  parts := strings.Split(filepath.ToSlash(specifier), "/")
  count := 1
  if strings.HasPrefix(specifier, "@") && len(parts) > 1 {
    count = 2
  }
  if len(parts) <= count {
    return ""
  }
  return strings.Join(parts[count:], "/")
}

func compilerOptionCandidates(configs []*tsoptions.ParsedCommandLine, specifier string, context ModuleResolutionContext) []string {
  candidates := []string{}
  for _, parsed := range configs {
    if parsed == nil || parsed.ParsedConfig == nil || parsed.ParsedConfig.CompilerOptions == nil {
      continue
    }
    options := parsed.ParsedConfig.CompilerOptions
    if options.Paths == nil {
      continue
    }
    base := options.GetPathsBasePath(parsed.GetCurrentDirectory())
    pattern := ""
    matched := ""
    targets := []string(nil)
    for candidatePattern, candidateTargets := range options.Paths.Entries() {
      if candidatePattern == specifier {
        pattern = candidatePattern
        matched = ""
        targets = candidateTargets
        break
      }
      candidateMatched, ok := matchPathPattern(candidatePattern, specifier)
      if !ok || (pattern != "" && comparePatternKeys(candidatePattern, pattern) >= 0) {
        continue
      }
      pattern = candidatePattern
      matched = candidateMatched
      targets = candidateTargets
    }
    if pattern == "" {
      continue
    }
    for _, target := range targets {
      target = strings.Replace(target, "*", matched, 1)
      candidates = append(candidates, moduleFileCandidates(filepath.Join(base, filepath.FromSlash(target)), context, true)...)
    }
  }
  return candidates
}

func rootDirsCandidates(configs []*tsoptions.ParsedCommandLine, directory, specifier string, context ModuleResolutionContext) []string {
  candidates := []string{}
  for _, parsed := range configs {
    if parsed == nil || parsed.ParsedConfig == nil || parsed.ParsedConfig.CompilerOptions == nil {
      continue
    }
    roots := parsed.ParsedConfig.CompilerOptions.RootDirs
    candidate := filepath.Clean(filepath.Join(directory, filepath.FromSlash(specifier)))
    matchedRoot := ""
    suffix := ""
    for _, root := range roots {
      relative, err := filepath.Rel(root, candidate)
      if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
        continue
      }
      if len(root) > len(matchedRoot) {
        matchedRoot = root
        suffix = relative
      }
    }
    if matchedRoot == "" {
      continue
    }
    for _, targetRoot := range roots {
      if filepath.Clean(targetRoot) == filepath.Clean(matchedRoot) {
        continue
      }
      candidates = append(candidates, moduleFileCandidates(filepath.Join(targetRoot, suffix), context, true)...)
    }
  }
  return candidates
}

func matchPathPattern(pattern, specifier string) (string, bool) {
  star := strings.IndexByte(pattern, '*')
  if star < 0 {
    return "", pattern == specifier
  }
  prefix := pattern[:star]
  suffix := pattern[star+1:]
  if len(specifier) < len(prefix)+len(suffix) || !strings.HasPrefix(specifier, prefix) || !strings.HasSuffix(specifier, suffix) {
    return "", false
  }
  return specifier[len(prefix) : len(specifier)-len(suffix)], true
}

func matchingPackageProperty(properties []packageProperty, request string) (packageProperty, string, bool) {
  for _, property := range properties {
    if property.key == request {
      return property, "", true
    }
  }
  var selected *packageProperty
  selectedText := ""
  for index := range properties {
    matched, ok := matchPackagePathPattern(properties[index].key, request)
    if !ok || (selected != nil && comparePatternKeys(properties[index].key, selected.key) >= 0) {
      continue
    }
    selected = &properties[index]
    selectedText = matched
  }
  if selected == nil {
    return packageProperty{}, "", false
  }
  return *selected, selectedText, true
}

func matchPackagePathPattern(pattern, request string) (string, bool) {
  if matched, ok := matchPathPattern(pattern, request); ok {
    return matched, true
  }
  if strings.HasSuffix(pattern, "/") && strings.HasPrefix(request, pattern) {
    return request[len(pattern):], true
  }
  return "", false
}

// comparePatternKeys is the TypeScript-Go resolver's pattern ordering: the
// longest prefix wins, then a pattern with the longest trailer. It lets the
// host retain candidates from exactly the one mapping the compiler selected.
func comparePatternKeys(left, right string) int {
  leftStar := strings.IndexByte(left, '*')
  rightStar := strings.IndexByte(right, '*')
  leftBaseLength := len(left)
  if leftStar >= 0 {
    leftBaseLength = leftStar + 1
  }
  rightBaseLength := len(right)
  if rightStar >= 0 {
    rightBaseLength = rightStar + 1
  }
  switch {
  case leftBaseLength > rightBaseLength:
    return -1
  case leftBaseLength < rightBaseLength:
    return 1
  case leftStar < 0:
    return 1
  case rightStar < 0:
    return -1
  case len(left) > len(right):
    return -1
  case len(left) < len(right):
    return 1
  default:
    return 0
  }
}

func packageRoot(base, specifier string) string {
  parts := strings.Split(filepath.ToSlash(specifier), "/")
  count := 1
  if strings.HasPrefix(specifier, "@") && len(parts) > 1 {
    count = 2
  }
  suffixCount := len(parts) - count
  root := base
  for range suffixCount {
    root = filepath.Dir(root)
  }
  return root
}

func compactStringsInOrder(input []string) []string {
  output := make([]string, 0, len(input))
  seen := map[string]struct{}{}
  for _, value := range input {
    if strings.TrimSpace(value) == "" {
      continue
    }
    if _, exists := seen[value]; exists {
      continue
    }
    seen[value] = struct{}{}
    output = append(output, value)
  }
  return output
}
