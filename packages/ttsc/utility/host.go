package utility

import (
  "encoding/json"
  "flag"
  "fmt"
  "os"
  "os/exec"
  "path/filepath"
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

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

// RunCheck validates the project and first-party utility plugin configuration
// without emitting output.
func RunCheck(args []string) int {
  opts, ok := parseHostOptions("check", args)
  if !ok {
    return 2
  }
  opts.noEmit = true
  prog, _, _, _, ok := loadUtilityProgram(opts)
  if !ok {
    return 2
  }
  defer prog.Close()
  return 0
}

// RunBuild hosts first-party utility transform plugins inside one compiler emit.
func RunBuild(args []string) int {
  opts, ok := parseHostOptions("build", args)
  if !ok {
    return 2
  }
  prog, entries, _, sourcePreamble, ok := loadUtilityProgram(opts)
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
  res, eDiags, err = prog.EmitAllRaw(makeSourcePreambleWriteFile(prog, sourcePreamble))
  if err != nil {
    fmt.Fprintf(os.Stderr, "ttsc utility: emit failed: %v\n", err)
    return 3
  }
  for _, d := range eDiags {
    fmt.Fprintln(os.Stderr, "  -", d.String())
  }
  if driver.CountErrors(eDiags) > 0 {
    return 2
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
  prog, _, _, sourcePreamble, ok := loadUtilityProgram(opts)
  if !ok {
    return 2
  }
  defer prog.Close()
  printer := shimprinter.NewPrinter(shimprinter.PrinterOptions{}, shimprinter.PrintHandlers{}, nil)
  out := transformResult{TypeScript: map[string]string{}}
  for _, file := range prog.SourceFiles() {
    text := shimprinter.EmitSourceFile(printer, file)
    if sourcePreamble != "" && !shouldRemoveComments(prog) && !strings.Contains(text, sourcePreamble) {
      text = driver.ApplySourcePreamble(text, sourcePreamble)
    }
    out.TypeScript[apiOutputKey(opts.cwd, file.FileName())] = text
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
  if err := fs.Parse(filterHostArgs(args)); err != nil {
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

func filterHostArgs(args []string) []string {
  known := map[string]bool{
    "cwd":          true,
    "emit":         false,
    "noEmit":       false,
    "outDir":       true,
    "plugins-json": true,
    "quiet":        false,
    "tsconfig":     true,
    "verbose":      false,
  }
  filtered := make([]string, 0, len(args))
  for i := 0; i < len(args); i++ {
    current := args[i]
    if current == "--" {
      break
    }
    if !strings.HasPrefix(current, "--") {
      filtered = append(filtered, current)
      continue
    }
    name, hasInlineValue := flagName(current)
    takesValue, ok := known[name]
    if ok {
      filtered = append(filtered, current)
      if takesValue && !hasInlineValue && i+1 < len(args) {
        i++
        filtered = append(filtered, args[i])
      }
      continue
    }
    if !hasInlineValue && i+1 < len(args) && !strings.HasPrefix(args[i+1], "-") {
      i++
    }
  }
  return filtered
}

func flagName(arg string) (string, bool) {
  name := strings.TrimPrefix(arg, "--")
  before, _, found := strings.Cut(name, "=")
  return before, found
}

func loadUtilityProgram(opts hostOptions) (*driver.Program, []pluginEntry, transformState, string, bool) {
  entries, err := parsePluginEntries(opts.pluginsJSON)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, nil, transformState{}, "", false
  }
  sourcePreamble, err := prepareSourcePreamble(entries, opts.cwd, opts.tsconfig)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return nil, nil, transformState{}, "", false
  }
  prog, diags, err := driver.LoadProgram(opts.cwd, opts.tsconfig, driver.LoadProgramOptions{
    ForceEmit:      opts.emit,
    ForceNoEmit:    opts.noEmit,
    OutDir:         opts.outDir,
    SourcePreamble: sourcePreamble,
  })
  if err != nil {
    fmt.Fprintf(os.Stderr, "ttsc utility: %v\n", err)
    return nil, nil, transformState{}, "", false
  }
  if len(diags) > 0 {
    driver.WritePrettyDiagnostics(os.Stderr, diags, opts.cwd)
    if prog != nil {
      _ = prog.Close()
    }
    return nil, nil, transformState{}, "", false
  }
  if diags := prog.Diagnostics(); len(diags) > 0 {
    driver.WritePrettyDiagnostics(os.Stderr, diags, opts.cwd)
    _ = prog.Close()
    return nil, nil, transformState{}, "", false
  }
  state, err := prepareTransforms(prog, entries)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    _ = prog.Close()
    return nil, nil, transformState{}, "", false
  }
  if err := applySourceTransforms(prog, state); err != nil {
    fmt.Fprintln(os.Stderr, err)
    _ = prog.Close()
    return nil, nil, transformState{}, "", false
  }
  return prog, entries, state, sourcePreamble, true
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

func prepareSourcePreamble(entries []pluginEntry, cwd, tsconfigPath string) (string, error) {
  var preamble strings.Builder
  for _, entry := range entries {
    if entry.Name != "@ttsc/banner" {
      continue
    }
    banner, err := parseBanner(entry.Config, cwd, tsconfigPath)
    if err != nil {
      return "", err
    }
    preamble.WriteString(banner)
  }
  return preamble.String(), nil
}

func makeSourcePreambleWriteFile(prog *driver.Program, sourcePreamble string) shimcompiler.WriteFile {
  if sourcePreamble == "" || shouldRemoveComments(prog) {
    return nil
  }
  return func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    if shouldEnsureSourcePreamble(fileName, text, sourcePreamble) {
      text = driver.ApplySourcePreamble(text, sourcePreamble)
    }
    return driver.DefaultWriteFile(fileName, text)
  }
}

func shouldRemoveComments(prog *driver.Program) bool {
  if prog == nil || prog.ParsedConfig == nil || prog.ParsedConfig.ParsedConfig == nil || prog.ParsedConfig.ParsedConfig.CompilerOptions == nil {
    return false
  }
  return prog.ParsedConfig.ParsedConfig.CompilerOptions.RemoveComments.IsTrue()
}

func shouldEnsureSourcePreamble(fileName, text, sourcePreamble string) bool {
  return isSourcePreambleOutputTarget(fileName) && !strings.Contains(text, sourcePreamble)
}

func isSourcePreambleOutputTarget(fileName string) bool {
  lower := strings.ToLower(filepath.ToSlash(fileName))
  for _, suffix := range []string{".d.ts", ".d.mts", ".d.cts", ".js", ".jsx", ".mjs", ".cjs"} {
    if strings.HasSuffix(lower, suffix) {
      return true
    }
  }
  return false
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
  if err != nil || isOutsideRelativePath(rel) {
    return filepath.ToSlash(fileName)
  }
  return filepath.ToSlash(rel)
}

func isOutsideRelativePath(rel string) bool {
  return rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func parseBanner(config map[string]any, cwd, tsconfigPath string) (string, error) {
  text, err := resolveBannerText(config, cwd, tsconfigPath)
  if err != nil {
    return "", err
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

func resolveBannerText(config map[string]any, cwd, tsconfigPath string) (string, error) {
  if text, ok, err := bannerTextFromConfigValue(config["text"], `"text"`); ok || err != nil {
    return text, err
  }
  if rawConfigPath, ok := config["config"]; ok {
    configPath, ok := rawConfigPath.(string)
    if !ok || strings.TrimSpace(configPath) == "" {
      return "", fmt.Errorf("@ttsc/banner: \"config\" must be a non-empty string path")
    }
    location := resolveBannerConfigPath(configPath, cwd, tsconfigPath)
    raw, err := loadBannerConfigFile(location)
    if err != nil {
      return "", err
    }
    text, ok, err := bannerTextFromConfigValue(raw, filepath.Base(location))
    if err != nil {
      return "", err
    }
    if !ok {
      return "", fmt.Errorf("@ttsc/banner: %s must export a non-empty string or an object with a non-empty \"text\" string", location)
    }
    return text, nil
  }
  location, err := findBannerConfigFile(cwd, tsconfigPath)
  if err != nil {
    return "", err
  }
  if location == "" {
    return "", fmt.Errorf("@ttsc/banner: \"text\" must be a non-empty string or a banner.config.{js,cjs,mjs,ts,mts,cts} file must exist")
  }
  raw, err := loadBannerConfigFile(location)
  if err != nil {
    return "", err
  }
  text, ok, err := bannerTextFromConfigValue(raw, filepath.Base(location))
  if err != nil {
    return "", err
  }
  if !ok {
    return "", fmt.Errorf("@ttsc/banner: %s must export a non-empty string or an object with a non-empty \"text\" string", location)
  }
  return text, nil
}

func bannerTextFromConfigValue(raw any, label string) (string, bool, error) {
  if raw == nil {
    return "", false, nil
  }
  text, ok := raw.(string)
  if ok {
    if strings.TrimSpace(text) == "" {
      return "", true, fmt.Errorf("@ttsc/banner: %s must be a non-empty string", label)
    }
    return text, true, nil
  }
  object, ok := raw.(map[string]any)
  if !ok {
    return "", true, fmt.Errorf("@ttsc/banner: %s must be a string or an object with a non-empty \"text\" string", label)
  }
  rawText, ok := object["text"]
  if !ok {
    return "", false, nil
  }
  text, ok = rawText.(string)
  if !ok || strings.TrimSpace(text) == "" {
    return "", true, fmt.Errorf("@ttsc/banner: %s.text must be a non-empty string", label)
  }
  return text, true, nil
}

func findBannerConfigFile(cwd, tsconfigPath string) (string, error) {
  dir := discoveryConfigBaseDir(cwd, tsconfigPath)
  for {
    matches := make([]string, 0, 1)
    for _, name := range []string{
      "banner.config.js",
      "banner.config.cjs",
      "banner.config.mjs",
      "banner.config.ts",
      "banner.config.cts",
      "banner.config.mts",
    } {
      candidate := filepath.Join(dir, name)
      if stat, err := os.Stat(candidate); err == nil && !stat.IsDir() {
        matches = append(matches, candidate)
      }
    }
    if len(matches) > 1 {
      return "", fmt.Errorf("@ttsc/banner: multiple banner.config.* files found in %s", dir)
    }
    if len(matches) == 1 {
      return matches[0], nil
    }
    parent := filepath.Dir(dir)
    if parent == dir {
      return "", nil
    }
    dir = parent
  }
}

func resolveBannerConfigPath(configPath, cwd, tsconfigPath string) string {
  if filepath.IsAbs(configPath) {
    return configPath
  }
  return filepath.Join(tsconfigBaseDir(cwd, tsconfigPath), configPath)
}

func tsconfigBaseDir(cwd, tsconfigPath string) string {
  if tsconfigPath == "" {
    return cwd
  }
  resolvedTsconfig := tsconfigPath
  if !filepath.IsAbs(resolvedTsconfig) {
    resolvedTsconfig = filepath.Join(cwd, resolvedTsconfig)
  }
  return filepath.Dir(resolvedTsconfig)
}

func discoveryConfigBaseDir(cwd, tsconfigPath string) string {
  if tsconfigPath != "" {
    resolvedTsconfig := tsconfigPath
    if !filepath.IsAbs(resolvedTsconfig) {
      resolvedTsconfig = filepath.Join(cwd, resolvedTsconfig)
    }
    return filepath.Dir(resolvedTsconfig)
  }
  return cwd
}

func loadBannerConfigFile(location string) (any, error) {
  if !isBannerConfigFileName(filepath.Base(location)) {
    return nil, fmt.Errorf("@ttsc/banner: config file must be named banner.config.{js,cjs,mjs,ts,mts,cts}: %s", location)
  }
  ext := strings.ToLower(filepath.Ext(location))
  switch ext {
  case ".js", ".cjs", ".mjs":
    return loadBannerScriptConfigFile(location)
  case ".ts", ".cts", ".mts":
    return loadBannerTypeScriptConfigFile(location)
  default:
    return nil, fmt.Errorf("@ttsc/banner: unsupported config file extension %q for %s", ext, location)
  }
}

func isBannerConfigFileName(name string) bool {
  switch name {
  case "banner.config.js",
    "banner.config.cjs",
    "banner.config.mjs",
    "banner.config.ts",
    "banner.config.cts",
    "banner.config.mts":
    return true
  default:
    return false
  }
}

func loadBannerScriptConfigFile(location string) (any, error) {
  const script = `
const { pathToFileURL } = require("node:url");

(async () => {
  const mod = await import(pathToFileURL(process.argv[1]).href);
  const candidate = Object.prototype.hasOwnProperty.call(mod, "default") ? mod.default : mod;
  const value = typeof candidate === "function" ? await candidate() : candidate;
  process.stdout.write(JSON.stringify(toSerializableBanner(value)));
})().catch((error) => {
  process.stderr.write(error && error.stack ? error.stack : String(error));
  process.exit(1);
});

function toSerializableBanner(value) {
  if (typeof value === "string") {
    return value;
  }
  if (value !== null && typeof value === "object" && typeof value.text === "string") {
    return { text: value.text };
  }
  throw new Error("config file must export a string or an object with a text string");
}
`
  node := os.Getenv("TTSC_NODE_BINARY")
  if node == "" {
    node = "node"
  }
  cmd := exec.Command(node, "-e", script, location)
  cmd.Env = nodeConfigLoaderEnv(location)
  output, err := cmd.Output()
  if err != nil {
    stderr := ""
    if exit, ok := err.(*exec.ExitError); ok {
      stderr = strings.TrimSpace(string(exit.Stderr))
    }
    if stderr != "" {
      return nil, fmt.Errorf("@ttsc/banner: load config file %s: %s", location, stderr)
    }
    return nil, fmt.Errorf("@ttsc/banner: load config file %s: %w", location, err)
  }
  var out any
  if err := json.Unmarshal(output, &out); err != nil {
    return nil, fmt.Errorf("@ttsc/banner: parse config file %s output: %w", location, err)
  }
  return out, nil
}

func loadBannerTypeScriptConfigFile(location string) (any, error) {
  tempDir, err := os.MkdirTemp("", "ttsc-banner-config-")
  if err != nil {
    return nil, fmt.Errorf("@ttsc/banner: create config loader tempdir: %w", err)
  }
  defer os.RemoveAll(tempDir)

  if err := linkNearestNodeModules(tempDir, filepath.Dir(location)); err != nil {
    return nil, err
  }

  loader := filepath.Join(tempDir, "loader.mts")
  tsconfig := filepath.Join(tempDir, "tsconfig.json")
  importSpecifier, err := relativeImportSpecifier(tempDir, location)
  if err != nil {
    return nil, err
  }
  importLiteral, err := json.Marshal(importSpecifier)
  if err != nil {
    return nil, fmt.Errorf("@ttsc/banner: encode config import %s: %w", location, err)
  }
  if err := os.WriteFile(loader, []byte(bannerTypeScriptConfigLoaderSource(string(importLiteral))), 0o644); err != nil {
    return nil, fmt.Errorf("@ttsc/banner: write config loader: %w", err)
  }
  if err := os.WriteFile(tsconfig, []byte(typeScriptConfigLoaderTsconfig(loader, location, tempDir)), 0o644); err != nil {
    return nil, fmt.Errorf("@ttsc/banner: write config loader tsconfig: %w", err)
  }

  args := []string{
    "--project", tsconfig,
    "--cwd", tempDir,
    "--cache-dir", filepath.Join(tempDir, "cache"),
  }
  if tsgo := os.Getenv("TTSC_TSGO_BINARY"); tsgo != "" {
    args = append(args, "--binary", tsgo)
  }
  args = append(args, loader)

  cmd := ttsxCommand(args...)
  cmd.Env = nodeConfigLoaderEnv(location)
  output, err := cmd.Output()
  if err != nil {
    stderr := ""
    if exit, ok := err.(*exec.ExitError); ok {
      stderr = strings.TrimSpace(string(exit.Stderr))
    }
    if stderr != "" {
      return nil, fmt.Errorf("@ttsc/banner: load TypeScript config file %s: %s", location, stderr)
    }
    return nil, fmt.Errorf("@ttsc/banner: load TypeScript config file %s: %w", location, err)
  }
  var out any
  if err := json.Unmarshal(output, &out); err != nil {
    return nil, fmt.Errorf("@ttsc/banner: parse TypeScript config file %s output: %w", location, err)
  }
  return out, nil
}

func relativeImportSpecifier(fromDir, location string) (string, error) {
  relative, err := filepath.Rel(fromDir, location)
  if err != nil {
    return "", fmt.Errorf("@ttsc/banner: resolve relative config import %s: %w", location, err)
  }
  relative = filepath.ToSlash(relative)
  if strings.HasPrefix(relative, "../") || strings.HasPrefix(relative, "./") {
    return relative, nil
  }
  return "./" + relative, nil
}

func bannerTypeScriptConfigLoaderSource(importLiteral string) string {
  return fmt.Sprintf(`import * as importedConfig from %s;

declare const process: {
  stdout: { write(value: string): void };
  stderr: { write(value: string): void };
  exit(code?: number): never;
};

try {
  const value = await resolveConfig(importedConfig);
  process.stdout.write(JSON.stringify(toSerializableBanner(value)));
} catch (error) {
  process.stderr.write(error instanceof Error && error.stack ? error.stack : String(error));
  process.exit(1);
}

async function resolveConfig(value: unknown): Promise<unknown> {
  let current = value;
  for (let i = 0; i < 8; i++) {
    if (isObject(current) && hasOwn(current, "default")) {
      current = current.default;
      continue;
    }
    break;
  }
  if (typeof current === "function") {
    return await (current as () => unknown | Promise<unknown>)();
  }
  return current;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function toSerializableBanner(value: unknown): unknown {
  if (typeof value === "string") {
    return value;
  }
  if (isObject(value) && typeof value.text === "string") {
    return { text: value.text };
  }
  throw new Error("config file must export a string or an object with a text string");
}
`, importLiteral)
}

func typeScriptConfigLoaderTsconfig(loader, location, outDir string) string {
  content := map[string]any{
    "compilerOptions": map[string]any{
      "allowImportingTsExtensions":      true,
      "module":                          "ESNext",
      "moduleResolution":                "bundler",
      "outDir":                          filepath.ToSlash(filepath.Join(outDir, "out")),
      "rewriteRelativeImportExtensions": true,
      "rootDir":                         "/",
      "skipLibCheck":                    true,
      "strict":                          true,
      "target":                          "ES2022",
    },
    "files": []string{
      filepath.ToSlash(loader),
      filepath.ToSlash(location),
    },
  }
  body, err := json.MarshalIndent(content, "", "  ")
  if err != nil {
    panic(err)
  }
  return string(body)
}

func ttsxCommand(args ...string) *exec.Cmd {
  ttsx := os.Getenv("TTSC_TTSX_BINARY")
  if ttsx == "" {
    ttsx = "ttsx"
  }
  if shouldRunTtsxThroughNode(ttsx) {
    node := os.Getenv("TTSC_NODE_BINARY")
    if node == "" {
      node = "node"
    }
    return exec.Command(node, append([]string{ttsx}, args...)...)
  }
  return exec.Command(ttsx, args...)
}

func shouldRunTtsxThroughNode(binary string) bool {
  switch strings.ToLower(filepath.Ext(binary)) {
  case ".js", ".cjs", ".mjs", ".ts", ".cts", ".mts":
    return true
  default:
    return false
  }
}

func nodeConfigLoaderEnv(location string) []string {
  env := os.Environ()
  parts := make([]string, 0, 2)
  if nodeModules := findNearestNodeModules(filepath.Dir(location)); nodeModules != "" {
    parts = append(parts, nodeModules)
  }
  if existing := os.Getenv("NODE_PATH"); existing != "" {
    parts = append(parts, existing)
  }
  if len(parts) == 0 {
    return env
  }
  return setEnv(env, "NODE_PATH", strings.Join(parts, string(os.PathListSeparator)))
}

func linkNearestNodeModules(tempDir, sourceDir string) error {
  nodeModules := findNearestNodeModules(sourceDir)
  if nodeModules == "" {
    return nil
  }
  link := filepath.Join(tempDir, "node_modules")
  if err := os.Symlink(nodeModules, link); err != nil {
    return fmt.Errorf("@ttsc/banner: link config node_modules %s: %w", nodeModules, err)
  }
  return nil
}

func findNearestNodeModules(start string) string {
  dir := filepath.Clean(start)
  for {
    candidate := filepath.Join(dir, "node_modules")
    if stat, err := os.Stat(candidate); err == nil && stat.IsDir() {
      return candidate
    }
    parent := filepath.Dir(dir)
    if parent == dir {
      return ""
    }
    dir = parent
  }
}

func setEnv(env []string, key, value string) []string {
  prefix := key + "="
  for i, entry := range env {
    if strings.HasPrefix(entry, prefix) {
      env[i] = prefix + value
      return env
    }
  }
  return append(env, prefix+value)
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
  for _, ext := range []string{".ts", ".tsx", ".mts", ".cts"} {
    if source, ok := r.sourceFiles[normalizePath(filepath.Join(stem, "index"+ext))]; ok {
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
  if err != nil || isOutsideRelativePath(rel) {
    return ""
  }
  return normalizePath(filepath.Join(r.outDir, replaceSourceExtension(rel, emittedJavaScriptExtension(rel))))
}

func emittedJavaScriptExtension(source string) string {
  switch strings.ToLower(filepath.Ext(source)) {
  case ".mts":
    return ".mjs"
  case ".cts":
    return ".cjs"
  default:
    return ".js"
  }
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
  _, hasCalls := config["calls"]
  _, hasStatements := config["statements"]
  if !hasCalls && !hasStatements {
    config = map[string]any{
      "calls":      []any{"console.log", "console.debug", "assert.*"},
      "statements": []any{"debugger"},
    }
  }
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
  out := make([]*shimast.Node, 0, len(list.Nodes))
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
  filterEmbeddedStatements(node, strip)
  if node.CanHaveStatements() {
    filterStatements(node.StatementList(), strip)
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    filterChildStatements(child, strip)
    return false
  })
}

func filterEmbeddedStatements(node *shimast.Node, strip *stripRewriter) {
  switch node.Kind {
  case shimast.KindIfStatement:
    stmt := node.AsIfStatement()
    stmt.ThenStatement = filterEmbeddedStatement(stmt.ThenStatement, strip)
    stmt.ElseStatement = filterEmbeddedStatement(stmt.ElseStatement, strip)
  case shimast.KindDoStatement:
    stmt := node.AsDoStatement()
    stmt.Statement = filterEmbeddedStatement(stmt.Statement, strip)
  case shimast.KindWhileStatement:
    stmt := node.AsWhileStatement()
    stmt.Statement = filterEmbeddedStatement(stmt.Statement, strip)
  case shimast.KindForStatement:
    stmt := node.AsForStatement()
    stmt.Statement = filterEmbeddedStatement(stmt.Statement, strip)
  case shimast.KindForInStatement, shimast.KindForOfStatement:
    stmt := node.AsForInOrOfStatement()
    stmt.Statement = filterEmbeddedStatement(stmt.Statement, strip)
  case shimast.KindWithStatement:
    stmt := node.AsWithStatement()
    stmt.Statement = filterEmbeddedStatement(stmt.Statement, strip)
  case shimast.KindLabeledStatement:
    stmt := node.AsLabeledStatement()
    stmt.Statement = filterEmbeddedStatement(stmt.Statement, strip)
  }
}

func filterEmbeddedStatement(stmt *shimast.Statement, strip *stripRewriter) *shimast.Statement {
  if stmt == nil {
    return nil
  }
  if shouldStripStatement(stmt, strip) {
    return emptyStatement(stmt)
  }
  filterChildStatements(stmt, strip)
  return stmt
}

func emptyStatement(original *shimast.Node) *shimast.Statement {
  empty := shimast.NewNodeFactory(shimast.NodeFactoryHooks{}).NewEmptyStatement()
  empty.Flags |= shimast.NodeFlagsSynthesized
  if original != nil {
    empty.Loc = original.Loc
  }
  return empty
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
