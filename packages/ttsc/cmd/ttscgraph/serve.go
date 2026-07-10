package main

import (
  "bufio"
  "crypto/sha256"
  "encoding/json"
  "errors"
  "flag"
  "fmt"
  "io"
  "os"
  "path/filepath"
  "slices"
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimtsoptions "github.com/microsoft/typescript-go/shim/tsoptions"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph"
)

type serveRequest struct {
  ID int `json:"id"`
}

type serveResponse struct {
  Dump    *graph.Dump `json:"dump,omitempty"`
  Error   string      `json:"error,omitempty"`
  ID      int         `json:"id"`
  Mode    string      `json:"mode,omitempty"`
  Changed bool        `json:"changed"`
}

type graphSession struct {
  cwd          string
  tsconfig     string
  compiler     *driver.Session
  configHashes map[string][sha256.Size]byte
  auxStates    map[string]diskState
  sourceHashes map[string][sha256.Size]byte
  rootFiles    []string
  initialized  bool
}

func newGraphSession(cwd, tsconfig string) (*graphSession, error) {
  session := &graphSession{cwd: cwd, tsconfig: tsconfig}
  if err := session.reload(); err != nil {
    return nil, err
  }
  return session, nil
}

func (s *graphSession) Close() error {
  if s.compiler == nil {
    return nil
  }
  return s.compiler.Close()
}

func (s *graphSession) Snapshot() (*graph.Dump, string, bool, error) {
  if !s.initialized {
    dump := s.buildDump()
    s.initialized = true
    return &dump, "initial", true, nil
  }

  configChanged, err := hashesChanged(s.configHashes)
  if err != nil {
    return nil, "", false, err
  }
  if configChanged {
    if err := s.reload(); err != nil {
      return nil, "", false, err
    }
    dump := s.buildDump()
    return &dump, "reload", true, nil
  }

  auxChanged, err := diskStatesChanged(s.auxStates)
  if err != nil {
    return nil, "", false, err
  }
  if auxChanged {
    if err := s.reload(); err != nil {
      return nil, "", false, err
    }
    dump := s.buildDump()
    return &dump, "reload", true, nil
  }

  roots, err := projectRootFiles(s.compiler.Program(), true)
  if err != nil {
    return nil, "", false, err
  }
  if !slices.Equal(s.rootFiles, roots) {
    if err := s.reload(); err != nil {
      return nil, "", false, err
    }
    dump := s.buildDump()
    return &dump, "reload", true, nil
  }

  changed, deleted, err := changedSources(s.sourceHashes)
  if err != nil {
    return nil, "", false, err
  }
  if deleted {
    if err := s.reload(); err != nil {
      return nil, "", false, err
    }
    dump := s.buildDump()
    return &dump, "reload", true, nil
  }
  if len(changed) == 0 {
    return nil, "unchanged", false, nil
  }
  if s.compiler.Program().HasLinkedProgramPlugins() {
    if err := s.reload(); err != nil {
      return nil, "", false, err
    }
    dump := s.buildDump()
    return &dump, "reload", true, nil
  }

  mode := "incremental"
  paths := make([]string, 0, len(changed))
  for path := range changed {
    paths = append(paths, path)
  }
  sort.Strings(paths)
  for _, path := range paths {
    if reused := s.compiler.Apply(path, changed[path]); !reused {
      mode = "rebuild"
    }
    current, exists := s.compiler.SourceText(path)
    expected := driver.ApplySourcePreambleToFile(path, changed[path], s.compiler.Program().SourcePreamble)
    if !exists || current != expected {
      if err := s.reload(); err != nil {
        return nil, "", false, err
      }
      dump := s.buildDump()
      return &dump, "reload", true, nil
    }
  }
  if err := s.captureState(); err != nil {
    return nil, "", false, err
  }
  dump := s.buildDump()
  return &dump, mode, true, nil
}

func (s *graphSession) reload() error {
  next, diags, err := driver.NewSession(s.cwd, s.tsconfig, driver.LoadProgramOptions{})
  if err != nil {
    return err
  }
  if next == nil {
    if len(diags) == 0 {
      return errors.New("ttscgraph: compiler session was not created")
    }
    return invalidProjectError(diags)
  }
  previous := s.compiler
  s.compiler = next
  if err := s.captureState(); err != nil {
    _ = next.Close()
    s.compiler = previous
    return err
  }
  if previous != nil {
    _ = previous.Close()
  }
  return nil
}

func (s *graphSession) captureState() error {
  program := s.compiler.Program()
  configs, err := parsedConfigs(program)
  if err != nil {
    return err
  }
  configHashes, err := hashFiles(configFiles(configs))
  if err != nil {
    return err
  }
  sourceHashes, err := hashProgramSources(program)
  if err != nil {
    return err
  }
  auxStates, err := captureDiskStates(auxiliaryInputs(program, configs, s.cwd))
  if err != nil {
    return err
  }
  s.configHashes = configHashes
  s.auxStates = auxStates
  s.sourceHashes = sourceHashes
  s.rootFiles = projectRootFilesFromConfigs(configs, false)
  return nil
}

func (s *graphSession) buildDump() graph.Dump {
  program := s.compiler.Program()
  built := graph.Build(program)
  return graph.NewDump(
    built,
    s.cwd,
    s.tsconfig,
    graph.GitIgnoredFiles(s.cwd, built),
    graph.SourceTexts(program),
  )
}

func configFiles(configs []*shimtsoptions.ParsedCommandLine) []string {
  files := []string{}
  for _, parsed := range configs {
    files = append(files, parsed.ConfigName())
    files = append(files, parsed.ExtendedSourceFiles()...)
  }
  return compactSortedStrings(files)
}

func projectRootFiles(program *driver.Program, reload bool) ([]string, error) {
  configs, err := parsedConfigs(program)
  if err != nil {
    return nil, err
  }
  return projectRootFilesFromConfigs(configs, reload), nil
}

func projectRootFilesFromConfigs(configs []*shimtsoptions.ParsedCommandLine, reload bool) []string {
  roots := []string{}
  for _, parsed := range configs {
    current := parsed
    if reload {
      current = parsed.ReloadFileNamesOfParsedCommandLine(driver.DefaultFS())
    }
    config := current.ConfigName()
    for _, file := range current.FileNames() {
      roots = append(roots, config+"\x00"+file)
    }
  }
  return compactSortedStrings(roots)
}

func parsedConfigs(program *driver.Program) ([]*shimtsoptions.ParsedCommandLine, error) {
  if program == nil || program.ParsedConfig == nil {
    return nil, errors.New("ttscgraph: compiler program omitted its parsed config")
  }
  resolved := make(map[string]*shimtsoptions.ParsedCommandLine)
  for _, parsed := range program.TSProgram.GetResolvedProjectReferences() {
    if parsed != nil {
      resolved[shimtspath.ResolvePath(parsed.ConfigName())] = parsed
    }
  }
  configs := []*shimtsoptions.ParsedCommandLine{}
  pending := []*shimtsoptions.ParsedCommandLine{program.ParsedConfig}
  seen := make(map[string]struct{})
  for len(pending) > 0 {
    parsed := pending[0]
    pending = pending[1:]
    config := shimtspath.ResolvePath(parsed.ConfigName())
    if _, exists := seen[config]; exists {
      continue
    }
    seen[config] = struct{}{}
    configs = append(configs, parsed)
    for _, reference := range parsed.ResolvedProjectReferencePaths() {
      reference = shimtspath.ResolvePath(reference)
      child := resolved[reference]
      if child == nil {
        fs := program.FS
        cwd := filepath.Dir(reference)
        var diags []driver.Diagnostic
        var err error
        child, diags, err = driver.ParseTSConfig(fs, cwd, reference, driver.DefaultHost(cwd, fs), nil)
        if err != nil {
          return nil, err
        }
        if child == nil {
          if len(diags) == 0 {
            return nil, fmt.Errorf("ttscgraph: project reference was not parsed: %s", reference)
          }
          return nil, invalidProjectError(diags)
        }
        resolved[reference] = child
      }
      pending = append(pending, child)
    }
  }
  return configs, nil
}

func invalidProjectError(diags []driver.Diagnostic) error {
  messages := make([]string, len(diags))
  for i, diag := range diags {
    messages[i] = diag.String()
  }
  return fmt.Errorf("ttscgraph: invalid project: %s", strings.Join(messages, "; "))
}

func hashProgramSources(program *driver.Program) (map[string][sha256.Size]byte, error) {
  hashes := make(map[string][sha256.Size]byte)
  for _, source := range program.TSProgram.SourceFiles() {
    if !fileOnDisk(source) {
      continue
    }
    content, err := os.ReadFile(source.FileName())
    if err != nil {
      return nil, fmt.Errorf("ttscgraph: read %s: %w", source.FileName(), err)
    }
    rawHash := sha256.Sum256(content)
    expected := driver.ApplySourcePreambleToFile(source.FileName(), string(content), program.SourcePreamble)
    if source.Text() == expected {
      hashes[source.FileName()] = rawHash
    } else {
      // Force the next snapshot to revisit a file that changed while the
      // compiler session was loading instead of blessing mismatched disk text.
      hashes[source.FileName()] = sha256.Sum256([]byte(source.Text()))
    }
  }
  return hashes, nil
}

func fileOnDisk(source *shimast.SourceFile) bool {
  if source == nil || source.FileName() == "" {
    return false
  }
  info, err := os.Stat(source.FileName())
  return err == nil && !info.IsDir()
}

func hashFiles(paths []string) (map[string][sha256.Size]byte, error) {
  hashes := make(map[string][sha256.Size]byte, len(paths))
  for _, path := range paths {
    content, err := os.ReadFile(path)
    if err != nil {
      return nil, fmt.Errorf("ttscgraph: read %s: %w", path, err)
    }
    hashes[path] = sha256.Sum256(content)
  }
  return hashes, nil
}

func hashesChanged(previous map[string][sha256.Size]byte) (bool, error) {
  for path, oldHash := range previous {
    content, err := os.ReadFile(path)
    if err != nil {
      if errors.Is(err, os.ErrNotExist) {
        return true, nil
      }
      return false, fmt.Errorf("ttscgraph: read %s: %w", path, err)
    }
    if sha256.Sum256(content) != oldHash {
      return true, nil
    }
  }
  return false, nil
}

func changedSources(previous map[string][sha256.Size]byte) (map[string]string, bool, error) {
  changed := map[string]string{}
  for path, oldHash := range previous {
    content, err := os.ReadFile(path)
    if err != nil {
      if errors.Is(err, os.ErrNotExist) {
        return nil, true, nil
      }
      return nil, false, fmt.Errorf("ttscgraph: read %s: %w", path, err)
    }
    if sha256.Sum256(content) != oldHash {
      changed[path] = string(content)
    }
  }
  return changed, false, nil
}

type diskState struct {
  Hash   [sha256.Size]byte
  Exists bool
}

type packageTarget struct {
  path     string
  wildcard string
}

func captureDiskStates(paths []string) (map[string]diskState, error) {
  states := make(map[string]diskState, len(paths))
  for _, path := range paths {
    content, err := os.ReadFile(path)
    if err != nil {
      if errors.Is(err, os.ErrNotExist) || errors.Is(err, os.ErrInvalid) {
        states[path] = diskState{}
        continue
      }
      info, statErr := os.Stat(path)
      if statErr == nil && info.IsDir() {
        states[path] = diskState{Exists: true}
        continue
      }
      return nil, fmt.Errorf("ttscgraph: read snapshot input %s: %w", path, err)
    }
    states[path] = diskState{Hash: sha256.Sum256(content), Exists: true}
  }
  return states, nil
}

func diskStatesChanged(previous map[string]diskState) (bool, error) {
  paths := make([]string, 0, len(previous))
  for path := range previous {
    paths = append(paths, path)
  }
  current, err := captureDiskStates(paths)
  if err != nil {
    return false, err
  }
  for path, state := range previous {
    if current[path] != state {
      return true, nil
    }
  }
  return false, nil
}

func auxiliaryInputs(program *driver.Program, configs []*shimtsoptions.ParsedCommandLine, cwd string) []string {
  inputs := []string{
    filepath.Join(cwd, ".gitignore"),
    filepath.Join(cwd, ".git", "info", "exclude"),
    filepath.Join(cwd, "package.json"),
    filepath.Join(cwd, "package-lock.json"),
    filepath.Join(cwd, "pnpm-lock.yaml"),
    filepath.Join(cwd, "yarn.lock"),
    filepath.Join(cwd, "bun.lock"),
    filepath.Join(cwd, "bun.lockb"),
  }
  for _, source := range program.TSProgram.SourceFiles() {
    file := source.FileName()
    if file == "" || strings.HasPrefix(file, "bundled:///") {
      continue
    }
    directory := filepath.Dir(file)
    inputs = appendAncestorInputs(inputs, directory, cwd)
    for _, reference := range source.ReferencedFiles {
      inputs = append(inputs, fileCandidates(filepath.Join(directory, filepath.FromSlash(reference.FileName)))...)
    }
    for _, reference := range source.TypeReferenceDirectives {
      inputs = append(inputs, typeReferenceCandidates(configs, directory, cwd, reference.FileName)...)
    }
    for _, specifier := range sourceModuleSpecifiers(source) {
      resolved := program.TSProgram.GetResolvedModuleFromModuleSpecifier(source, specifier)
      if resolved != nil && resolved.IsResolved() {
        continue
      }
      inputs = append(inputs, unresolvedModuleCandidates(configs, directory, cwd, specifier.Text())...)
    }
  }
  return compactSortedStrings(inputs)
}

func typeReferenceCandidates(configs []*shimtsoptions.ParsedCommandLine, directory, cwd, name string) []string {
  candidates := []string{}
  for _, parsed := range configs {
    if parsed == nil || parsed.ParsedConfig == nil || parsed.ParsedConfig.CompilerOptions == nil {
      continue
    }
    for _, root := range parsed.ParsedConfig.CompilerOptions.TypeRoots {
      candidates = append(candidates, fileCandidates(filepath.Join(root, filepath.FromSlash(name)))...)
    }
  }
  for current := filepath.Clean(directory); ; current = filepath.Dir(current) {
    candidates = append(candidates, fileCandidates(filepath.Join(current, "node_modules", "@types", filepath.FromSlash(name)))...)
    if current == filepath.Clean(cwd) || filepath.Dir(current) == current {
      return candidates
    }
  }
}

func sourceModuleSpecifiers(source *shimast.SourceFile) []*shimast.Node {
  if source == nil {
    return nil
  }
  specifiers := []*shimast.Node{}
  var walk func(*shimast.Node) bool
  walk = func(node *shimast.Node) bool {
    if node == nil {
      return false
    }
    var specifier *shimast.Node
    switch node.Kind {
    case shimast.KindImportDeclaration, shimast.KindJSImportDeclaration:
      specifier = node.AsImportDeclaration().ModuleSpecifier
    case shimast.KindExportDeclaration:
      specifier = node.AsExportDeclaration().ModuleSpecifier
    case shimast.KindImportEqualsDeclaration:
      reference := node.AsImportEqualsDeclaration().ModuleReference
      if reference != nil && reference.Kind == shimast.KindExternalModuleReference {
        specifier = reference.AsExternalModuleReference().Expression
      }
    case shimast.KindImportType:
      argument := node.AsImportTypeNode().Argument
      if argument != nil && argument.Kind == shimast.KindLiteralType {
        specifier = argument.AsLiteralTypeNode().Literal
      }
    case shimast.KindCallExpression:
      call := node.AsCallExpression()
      if isModuleSpecifierCall(call) && call.Arguments != nil && len(call.Arguments.Nodes) > 0 {
        specifier = call.Arguments.Nodes[0]
      }
    }
    if specifier != nil && (specifier.Kind == shimast.KindStringLiteral || specifier.Kind == shimast.KindNoSubstitutionTemplateLiteral) {
      specifiers = append(specifiers, specifier)
    }
    node.ForEachChild(walk)
    return false
  }
  walk(source.AsNode())
  return specifiers
}

func isModuleSpecifierCall(call *shimast.CallExpression) bool {
  if call == nil || call.Expression == nil {
    return false
  }
  if call.Expression.Kind == shimast.KindImportKeyword {
    return true
  }
  return call.Expression.Kind == shimast.KindIdentifier && call.Expression.Text() == "require"
}

func appendAncestorInputs(inputs []string, directory, stop string) []string {
  stop = filepath.Clean(stop)
  for current := filepath.Clean(directory); ; current = filepath.Dir(current) {
    inputs = append(inputs, filepath.Join(current, "package.json"), filepath.Join(current, ".gitignore"))
    if current == stop || filepath.Dir(current) == current {
      return inputs
    }
  }
}

func unresolvedModuleCandidates(configs []*shimtsoptions.ParsedCommandLine, directory, cwd, specifier string) []string {
  if specifier == "" {
    return nil
  }
  if strings.HasPrefix(specifier, ".") {
    candidates := fileCandidates(filepath.Clean(filepath.Join(directory, filepath.FromSlash(specifier))))
    return append(candidates, rootDirsCandidates(configs, directory, specifier)...)
  }
  candidates := compilerOptionCandidates(configs, specifier)
  if strings.HasPrefix(specifier, "#") {
    for current := filepath.Clean(directory); ; current = filepath.Dir(current) {
      candidates = append(candidates, packageManifestCandidates(current, specifier)...)
      if current == filepath.Clean(cwd) || filepath.Dir(current) == current {
        return candidates
      }
    }
  }
  for current := filepath.Clean(directory); ; current = filepath.Dir(current) {
    base := filepath.Join(current, "node_modules", filepath.FromSlash(specifier))
    root := packageRoot(base, specifier)
    candidates = append(candidates, fileCandidates(base)...)
    candidates = append(candidates, filepath.Join(root, "package.json"))
    candidates = append(candidates, packageManifestCandidates(root, packageSubpath(specifier))...)
    if current == filepath.Clean(cwd) || filepath.Dir(current) == current {
      break
    }
  }
  return candidates
}

func packageManifestCandidates(root, wildcard string) []string {
  content, err := os.ReadFile(filepath.Join(root, "package.json"))
  if err != nil {
    return nil
  }
  var manifest struct {
    Main          string `json:"main"`
    Module        string `json:"module"`
    Types         string `json:"types"`
    Typings       string `json:"typings"`
    Exports       any    `json:"exports"`
    Imports       any    `json:"imports"`
    TypesVersions any    `json:"typesVersions"`
  }
  if json.Unmarshal(content, &manifest) != nil {
    return nil
  }
  defaultWildcard := strings.TrimPrefix(strings.TrimPrefix(wildcard, "./"), "#")
  targets := []packageTarget{
    {path: manifest.Main, wildcard: defaultWildcard},
    {path: manifest.Module, wildcard: defaultWildcard},
    {path: manifest.Types, wildcard: defaultWildcard},
    {path: manifest.Typings, wildcard: defaultWildcard},
  }
  exportRequest := "."
  if wildcard != "" && !strings.HasPrefix(wildcard, "#") {
    exportRequest = "./" + strings.TrimPrefix(wildcard, "./")
  }
  collectPackageMappingTargets(manifest.Exports, exportRequest, defaultWildcard, &targets)
  collectPackageMappingTargets(manifest.Imports, wildcard, defaultWildcard, &targets)
  collectPackageTargets(manifest.TypesVersions, defaultWildcard, &targets)
  candidates := []string{}
  for _, target := range targets {
    if target.path == "" || filepath.IsAbs(target.path) || strings.Contains(target.path, "://") {
      continue
    }
    path := strings.Replace(target.path, "*", target.wildcard, 1)
    candidates = append(candidates, fileCandidates(filepath.Join(root, filepath.FromSlash(path)))...)
  }
  return candidates
}

func collectPackageMappingTargets(value any, request, wildcard string, targets *[]packageTarget) {
  if object, ok := value.(map[string]any); ok {
    mapping := false
    for key := range object {
      if strings.HasPrefix(key, ".") || strings.HasPrefix(key, "#") {
        mapping = true
        break
      }
    }
    if mapping {
      for pattern, child := range object {
        matched, ok := matchPathPattern(pattern, request)
        if ok {
          collectPackageTargets(child, matched, targets)
        }
      }
      return
    }
  }
  collectPackageTargets(value, wildcard, targets)
}

func collectPackageTargets(value any, wildcard string, targets *[]packageTarget) {
  switch value := value.(type) {
  case string:
    *targets = append(*targets, packageTarget{path: value, wildcard: wildcard})
  case []any:
    for _, child := range value {
      collectPackageTargets(child, wildcard, targets)
    }
  case map[string]any:
    for _, child := range value {
      collectPackageTargets(child, wildcard, targets)
    }
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

func compilerOptionCandidates(configs []*shimtsoptions.ParsedCommandLine, specifier string) []string {
  candidates := []string{}
  for _, parsed := range configs {
    if parsed == nil || parsed.ParsedConfig == nil || parsed.ParsedConfig.CompilerOptions == nil {
      continue
    }
    options := parsed.ParsedConfig.CompilerOptions
    if options.BaseUrl != "" {
      candidates = append(candidates, fileCandidates(filepath.Join(options.BaseUrl, filepath.FromSlash(specifier)))...)
    }
    if options.Paths == nil {
      continue
    }
    base := options.GetPathsBasePath(parsed.GetCurrentDirectory())
    for pattern, targets := range options.Paths.Entries() {
      matched, ok := matchPathPattern(pattern, specifier)
      if !ok {
        continue
      }
      for _, target := range targets {
        target = strings.Replace(target, "*", matched, 1)
        candidates = append(candidates, fileCandidates(filepath.Join(base, filepath.FromSlash(target)))...)
      }
    }
  }
  return candidates
}

func rootDirsCandidates(configs []*shimtsoptions.ParsedCommandLine, directory, specifier string) []string {
  candidates := []string{}
  for _, parsed := range configs {
    if parsed == nil || parsed.ParsedConfig == nil || parsed.ParsedConfig.CompilerOptions == nil {
      continue
    }
    roots := parsed.ParsedConfig.CompilerOptions.RootDirs
    for _, sourceRoot := range roots {
      relative, err := filepath.Rel(sourceRoot, directory)
      if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
        continue
      }
      suffix := filepath.Join(relative, filepath.FromSlash(specifier))
      for _, targetRoot := range roots {
        candidates = append(candidates, fileCandidates(filepath.Join(targetRoot, suffix))...)
      }
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

func fileCandidates(base string) []string {
  candidates := []string{base}
  extension := strings.ToLower(filepath.Ext(base))
  if extension == ".js" || extension == ".jsx" || extension == ".mjs" || extension == ".cjs" {
    base = strings.TrimSuffix(base, filepath.Ext(base))
  }
  for _, suffix := range []string{".ts", ".tsx", ".mts", ".cts", ".d.ts", ".d.mts", ".d.cts", ".js", ".jsx", ".mjs", ".cjs", ".json"} {
    candidates = append(candidates, base+suffix, filepath.Join(base, "index"+suffix))
  }
  candidates = append(candidates, filepath.Join(base, "package.json"))
  return candidates
}

func compactSortedStrings(input []string) []string {
  out := make([]string, 0, len(input))
  for _, value := range input {
    if strings.TrimSpace(value) != "" {
      out = append(out, value)
    }
  }
  sort.Strings(out)
  return slices.Compact(out)
}

func runServe(args []string) int {
  fs := flag.NewFlagSet("ttscgraph serve", flag.ContinueOnError)
  fs.SetOutput(stderr)
  cwdFlag := fs.String("cwd", "", "project root (defaults to process cwd)")
  tsconfigFlag := fs.String("tsconfig", "tsconfig.json", "project tsconfig path")
  if err := fs.Parse(args); err != nil {
    return 2
  }

  cwd := strings.TrimSpace(*cwdFlag)
  if cwd == "" {
    resolved, err := getwd()
    if err != nil {
      fmt.Fprintf(stderr, "ttscgraph: could not resolve working directory: %v\n", err)
      return 2
    }
    cwd = resolved
  }
  if abs, err := filepath.Abs(cwd); err == nil {
    cwd = abs
  }
  cwd = shimtspath.ResolvePath(cwd)
  tsconfig := strings.TrimSpace(*tsconfigFlag)

  return serveSnapshots(os.Stdin, stdout, cwd, tsconfig)
}

func serveSnapshots(input io.Reader, output io.Writer, cwd, tsconfig string) int {
  scanner := bufio.NewScanner(input)
  scanner.Buffer(make([]byte, 64*1024), 1024*1024)
  encoder := json.NewEncoder(output)
  var session *graphSession
  defer func() {
    if session != nil {
      _ = session.Close()
    }
  }()

  for scanner.Scan() {
    line := strings.TrimSpace(scanner.Text())
    if line == "" {
      continue
    }
    var request serveRequest
    if err := json.Unmarshal([]byte(line), &request); err != nil {
      _ = encoder.Encode(serveResponse{Error: fmt.Sprintf("invalid request: %v", err)})
      continue
    }
    if session == nil {
      created, err := newGraphSession(cwd, tsconfig)
      if err != nil {
        _ = encoder.Encode(serveResponse{ID: request.ID, Error: err.Error()})
        continue
      }
      session = created
    }
    dump, mode, changed, err := session.Snapshot()
    response := serveResponse{ID: request.ID, Dump: dump, Mode: mode, Changed: changed}
    if err != nil {
      response.Error = err.Error()
      response.Dump = nil
    }
    if err := encoder.Encode(response); err != nil {
      fmt.Fprintf(stderr, "ttscgraph: write serve response: %v\n", err)
      return 1
    }
  }
  if err := scanner.Err(); err != nil {
    fmt.Fprintf(stderr, "ttscgraph: read serve request: %v\n", err)
    return 1
  }
  return 0
}
